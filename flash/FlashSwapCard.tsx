import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, isAddress } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, AlertTriangle, Info, CheckCircle2, ShieldAlert, Code2 } from 'lucide-react';
import { FLASH_SWAP_ADDRESS, FLASH_SWAP_ABI, ERC20_ABI } from '@/utils/evmConfig';
import { useToast } from '@/hooks/use-toast';
import { useRelayer } from '@/context/RelayerProvider';

interface FlashSwapCardProps {
  className?: string;
}

export function FlashSwapCard({ className }: FlashSwapCardProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const { gaslessEnabled, setGaslessEnabled, relayerFeePercent } = useRelayer();
  
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [borrowerContract, setBorrowerContract] = useState('');
  const [calldata, setCalldata] = useState('0x');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [acknowledgeRisks, setAcknowledgeRisks] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'custom' | 'arbitrage' | 'liquidation'>('custom');

  // Validate addresses
  const isValidTokenAddress = tokenAddress && isAddress(tokenAddress);
  const isValidBorrowerAddress = borrowerContract && isAddress(borrowerContract);

  // Read token symbol for display
  const { data: tokenSymbol } = useReadContract({
    address: isValidTokenAddress ? (tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: !!isValidTokenAddress },
  });

  // Read token decimals
  const { data: tokenDecimals } = useReadContract({
    address: isValidTokenAddress ? (tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!isValidTokenAddress },
  });

  const decimals = tokenDecimals ? Number(tokenDecimals) : 18;

  // Read max flash loan available
  const { data: maxLoan, refetch: refetchMaxLoan } = useReadContract({
    address: FLASH_SWAP_ADDRESS as `0x${string}`,
    abi: FLASH_SWAP_ABI,
    functionName: 'maxFlashLoan',
    args: isValidTokenAddress ? [tokenAddress as `0x${string}`] : undefined,
    query: { enabled: !!isValidTokenAddress },
  });

  // Read flash fee
  const { data: flashFee } = useReadContract({
    address: FLASH_SWAP_ADDRESS as `0x${string}`,
    abi: FLASH_SWAP_ABI,
    functionName: 'flashFee',
    args:
      isValidTokenAddress && amount && parseFloat(amount) > 0
        ? [tokenAddress as `0x${string}`, parseUnits(amount, decimals)]
        : undefined,
    query: { enabled: !!(isValidTokenAddress && amount && parseFloat(amount) > 0) },
  });

  // Check if borrower is approved
  const { data: isBorrowerApproved, refetch: refetchBorrowerApproval } = useReadContract({
    address: FLASH_SWAP_ADDRESS as `0x${string}`,
    abi: FLASH_SWAP_ABI,
    functionName: 'isBorrowerApproved',
    args: isValidBorrowerAddress ? [borrowerContract as `0x${string}`] : undefined,
    query: { enabled: !!isValidBorrowerAddress },
  });

  const { writeContract, isPending: isExecuting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash: txHash,
    confirmations: 2 
  });

  // Calculate repayment amount
  const repaymentAmount =
    amount && flashFee && parseFloat(amount) > 0
      ? parseUnits(amount, decimals) + (flashFee as bigint)
      : BigInt(0);

  // Validate amount against max loan
  const amountBigInt = amount && parseFloat(amount) > 0 ? parseUnits(amount, decimals) : BigInt(0);
  const isAmountValid = amountBigInt > BigInt(0) && (!maxLoan || amountBigInt <= (maxLoan as bigint));

  // Validate calldata format
  const isCalldataValid = calldata.startsWith('0x');

  // Check if form is valid
  const isFormValid =
    isValidTokenAddress &&
    isValidBorrowerAddress &&
    isAmountValid &&
    isCalldataValid &&
    isBorrowerApproved &&
    acknowledgeRisks;

  // Parse error messages to plain English
  const parseErrorMessage = (error: any): string => {
    const errorMsg = error.message || error.toString();
    
    if (errorMsg.includes('UnauthorizedBorrower') || errorMsg.includes('not approved')) {
      return 'You are not an approved borrower. Contact governance to get your contract whitelisted.';
    }
    if (errorMsg.includes('InsufficientRepayment') || errorMsg.includes('repayment')) {
      return 'Repayment failed - your contract did not return the full loan amount + fee.';
    }
    if (errorMsg.includes('InvalidCallback') || errorMsg.includes('callback')) {
      return 'Callback failed - your contract must return keccak256("ERC3156FlashBorrower.onFlashLoan")';
    }
    if (errorMsg.includes('InvalidAmount') || errorMsg.includes('amount')) {
      return 'Invalid amount - exceeds maximum flash loan limit or insufficient liquidity.';
    }
    if (errorMsg.includes('InvalidToken')) {
      return 'Invalid token address provided.';
    }
    if (errorMsg.includes('user rejected') || errorMsg.includes('User denied')) {
      return 'Transaction cancelled by user.';
    }
    if (errorMsg.includes('insufficient funds')) {
      return 'Insufficient funds for gas fees.';
    }
    
    return errorMsg;
  };

  const { signAndRelayFlashLoan } = useRelayer();

  const handleExecuteFlashLoan = async () => {
    if (!isFormValid) return;

    try {
      const amountWei = parseUnits(amount, decimals);
      
      if (gaslessEnabled) {
        // Use relayer for gasless transaction
        const result = await signAndRelayFlashLoan(
          borrowerContract as `0x${string}`,
          tokenAddress as `0x${string}`,
          amountWei,
          calldata as `0x${string}`
        );
        
        if (result.success && result.txHash) {
          setTxHash(result.txHash as `0x${string}`);
        }
      } else {
        // Standard transaction with gas
        writeContract(
          {
            address: FLASH_SWAP_ADDRESS as `0x${string}`,
            abi: FLASH_SWAP_ABI,
            functionName: 'flashLoan',
            args: [
              borrowerContract as `0x${string}`,
              tokenAddress as `0x${string}`,
              amountWei,
              calldata as `0x${string}`,
            ],
          },
          {
            onSuccess: (hash) => {
              setTxHash(hash);
              toast({
                title: 'Flash Loan Initiated',
                description: `Transaction submitted: ${hash.slice(0, 10)}...`,
              });
            },
            onError: (error) => {
              console.error('Flash loan execution failed:', error);
              const friendlyError = parseErrorMessage(error);
              toast({
                title: 'Flash Loan Failed',
                description: friendlyError,
                variant: 'destructive',
              });
            },
          }
        );
      }
    } catch (error) {
      console.error('Flash loan execution failed:', error);
      const friendlyError = parseErrorMessage(error);
      toast({
        title: 'Error',
        description: friendlyError,
        variant: 'destructive',
      });
    }
  };

  // Show success toast when transaction confirms
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Flash Loan Executed Successfully',
        description: `Transaction confirmed: ${txHash?.slice(0, 10)}...`,
      });
      // Refetch data
      refetchMaxLoan();
      refetchBorrowerApproval();
      // Reset form
      setAmount('');
      setCalldata('0x');
      setTxHash(undefined);
    }
  }, [isSuccess, txHash, toast, refetchMaxLoan, refetchBorrowerApproval]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <CardTitle className="text-white">Flash Loans</CardTitle>
        </div>
        <CardDescription className="text-gray-400">
          Advanced feature for experienced users and automated strategies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CRITICAL WARNING BANNER */}
        <Alert className="bg-red-500/20 border-red-500/50 border-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <AlertTitle className="text-red-300 font-bold text-base mb-2">
            ⚠️ ADVANCED: Only for Experienced Users / Bots
          </AlertTitle>
          <AlertDescription className="text-red-200 text-sm space-y-2">
            <p className="font-semibold">Flash loans are extremely risky and require:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Deep understanding of smart contract development</li>
              <li>ERC-3156 compliant borrower contract</li>
              <li>Whitelisted contract address (approved by governance)</li>
              <li>Ability to repay loan + fee in same transaction</li>
              <li>Proper error handling and security measures</li>
            </ul>
            <p className="font-semibold mt-2">❌ Do NOT use if you don't understand these requirements</p>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="token-address" className="text-white">
            Token Address
          </Label>
          <Input
            id="token-address"
            placeholder="0x..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="bg-white/5 border-white/10 text-white font-mono"
            aria-describedby="token-address-error"
          />
          {tokenAddress && !isValidTokenAddress && (
            <p id="token-address-error" className="text-xs text-red-400">
              Invalid token address
            </p>
          )}
          {isValidTokenAddress && tokenSymbol && (
            <p className="text-xs text-green-400">Token: {tokenSymbol as string}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="loan-amount" className="text-white">
            Loan Amount
          </Label>
          <Input
            id="loan-amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-white/5 border-white/10 text-white"
            aria-describedby="loan-amount-error"
            min="0"
            step="any"
          />
          {amount && !isAmountValid && maxLoan ? (
            <p id="loan-amount-error" className="text-xs text-red-400">
              Amount exceeds max available: {formatUnits(maxLoan as bigint, decimals)}{' '}
              {(tokenSymbol as string) || 'tokens'}
            </p>
          ) : null}
        </div>

        {/* STRATEGY TEMPLATES */}
        <div className="space-y-2">
          <Label className="text-white">Strategy Template</Label>
          <Tabs value={selectedStrategy} onValueChange={(v) => setSelectedStrategy(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/5">
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
              <TabsTrigger value="liquidation">Liquidation</TabsTrigger>
            </TabsList>
            <TabsContent value="custom" className="space-y-2 mt-3">
              <p className="text-xs text-gray-400">
                Build your own flash loan strategy with custom contract logic.
              </p>
            </TabsContent>
            <TabsContent value="arbitrage" className="space-y-2 mt-3">
              <Alert className="bg-blue-500/10 border-blue-500/20">
                <Code2 className="w-4 h-4 text-blue-400" />
                <AlertDescription className="text-blue-300 text-xs">
                  <p className="font-semibold mb-1">Arbitrage Strategy Template:</p>
                  <p>1. Flash borrow token from this DEX</p>
                  <p>2. Swap on external DEX at better price</p>
                  <p>3. Repay flash loan + fee</p>
                  <p>4. Keep profit</p>
                  <p className="mt-2 text-blue-400">⚠️ You must implement this logic in your contract</p>
                </AlertDescription>
              </Alert>
            </TabsContent>
            <TabsContent value="liquidation" className="space-y-2 mt-3">
              <Alert className="bg-blue-500/10 border-blue-500/20">
                <Code2 className="w-4 h-4 text-blue-400" />
                <AlertDescription className="text-blue-300 text-xs">
                  <p className="font-semibold mb-1">Liquidation Strategy Template:</p>
                  <p>1. Flash borrow collateral token</p>
                  <p>2. Liquidate undercollateralized position</p>
                  <p>3. Receive liquidation bonus</p>
                  <p>4. Repay flash loan + fee</p>
                  <p>5. Keep bonus as profit</p>
                  <p className="mt-2 text-blue-400">⚠️ You must implement this logic in your contract</p>
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label htmlFor="borrower-contract" className="text-white">
            Whitelisted Borrower Contract Address *
          </Label>
          <Input
            id="borrower-contract"
            placeholder="0x... (Must be approved by governance)"
            value={borrowerContract}
            onChange={(e) => setBorrowerContract(e.target.value)}
            className="bg-white/5 border-white/10 text-white font-mono"
            aria-describedby="borrower-contract-error"
          />
          {borrowerContract && !isValidBorrowerAddress && (
            <p id="borrower-contract-error" className="text-xs text-red-400">
              Invalid borrower address
            </p>
          )}
          {isValidBorrowerAddress && isBorrowerApproved === false && (
            <Alert className="bg-red-500/10 border-red-500/20 mt-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-300 text-xs">
                ❌ This contract is NOT whitelisted. Flash loans will fail.
                <br />Contact governance to approve this borrower contract.
              </AlertDescription>
            </Alert>
          )}
          {isValidBorrowerAddress && isBorrowerApproved === true && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Borrower contract is whitelisted
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="calldata" className="text-white">
            Calldata (Optional)
          </Label>
          <Textarea
            id="calldata"
            placeholder="0x (hex encoded data for your callback)"
            value={calldata}
            onChange={(e) => setCalldata(e.target.value)}
            className="bg-white/5 border-white/10 text-white font-mono text-sm"
            rows={3}
            aria-describedby="calldata-error"
          />
          {!isCalldataValid && (
            <p id="calldata-error" className="text-xs text-red-400">
              Calldata must start with 0x
            </p>
          )}
          <p className="text-xs text-gray-500">
            Pass custom data to your borrower contract's onFlashLoan callback
          </p>
        </div>

        {/* FLASH LOAN DETAILS */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-300 w-full">
              <p className="font-semibold mb-2">Flash Loan Details</p>
              <ul className="space-y-1.5 text-xs text-blue-400">
                <li className="font-semibold text-blue-300">
                  📊 Max Available: {maxLoan ? `${formatUnits(maxLoan as bigint, decimals)} ${(tokenSymbol as string) || 'tokens'}` : 'Select token'}
                </li>
                <li>
                  💰 Fee (0.09%):{' '}
                  {flashFee && amount && parseFloat(amount) > 0
                    ? `${formatUnits(flashFee as bigint, decimals)} ${(tokenSymbol as string) || 'tokens'}`
                    : 'Enter amount'}
                </li>
                <li className="font-semibold text-blue-300">
                  💳 Total Repayment Required:{' '}
                  {repaymentAmount > BigInt(0)
                    ? `${formatUnits(repaymentAmount, decimals)} ${(tokenSymbol as string) || 'tokens'}`
                    : 'Enter amount'}
                </li>
                <li>
                  🔐 Borrower Status:{' '}
                  {isBorrowerApproved ? (
                    <span className="text-green-400 font-semibold">✅ Whitelisted</span>
                  ) : (
                    <span className="text-red-400 font-semibold">❌ Not Whitelisted</span>
                  )}
                </li>
                <li className="text-yellow-400">⚠️ Must repay within same transaction or it will revert</li>
              </ul>
            </div>
          </div>
        </div>

        {/* GASLESS TOGGLE */}
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2 flex-1">
              <Zap className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-300">
                <p className="font-semibold">Gasless Transaction</p>
                <p className="text-xs text-purple-400 mt-1">
                  Let the relayer pay gas fees (includes {relayerFeePercent}% service fee)
                </p>
              </div>
            </div>
            <Switch
              checked={gaslessEnabled}
              onCheckedChange={setGaslessEnabled}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>
        </div>

        {/* RISK ACKNOWLEDGMENT */}
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2 flex-1">
              <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-300">
                <p className="font-semibold">I understand the risks</p>
                <p className="text-xs text-orange-400 mt-1">
                  I confirm that I have a whitelisted ERC-3156 compliant contract that can repay the loan + fee in the same transaction.
                </p>
              </div>
            </div>
            <Switch
              checked={acknowledgeRisks}
              onCheckedChange={setAcknowledgeRisks}
              className="data-[state=checked]:bg-orange-500"
            />
          </div>
        </div>

        {isSuccess && (
          <Alert className="bg-green-500/10 border-green-500/20">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <AlertDescription className="text-green-300 text-sm">
              Flash loan executed successfully! Tx: {txHash?.slice(0, 10)}...
            </AlertDescription>
          </Alert>
        )}



        {writeError && (
          <Alert className="bg-red-500/10 border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <AlertTitle className="text-red-300 font-semibold mb-1">
              Transaction Failed
            </AlertTitle>
            <AlertDescription className="text-red-400 text-sm">
              {parseErrorMessage(writeError)}
            </AlertDescription>
          </Alert>
        )}

        {!address ? (
          <Button
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            disabled
          >
            Connect Wallet
          </Button>
        ) : !isBorrowerApproved && isValidBorrowerAddress ? (
          <Button
            className="w-full bg-red-500 hover:bg-red-600"
            disabled
          >
            ❌ Borrower Contract Not Whitelisted
          </Button>
        ) : !acknowledgeRisks ? (
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled
          >
            ⚠️ Acknowledge Risks to Continue
          </Button>
        ) : (
          <Button
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50"
            disabled={!isFormValid || isExecuting || isConfirming}
            onClick={handleExecuteFlashLoan}
            aria-busy={isExecuting || isConfirming}
          >
            {isExecuting || isConfirming ? 'Executing...' : '⚡ Execute Flash Loan'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
