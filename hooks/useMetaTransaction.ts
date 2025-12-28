// Copyright ONYX Protocol
import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ethers } from 'ethers';

interface ForwardRequest {
  from: string;
  to: string;
  value: string;
  gas: string;
  nonce: string;
  data: string;
}

interface MetaTxResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function useMetaTransaction() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [isRelaying, setIsRelaying] = useState(false);

  const signMetaTransaction = async (
    to: string,
    data: string,
    value: string = '0',
    gasLimit: string = '500000'
  ): Promise<{ request: ForwardRequest; signature: string } | null> => {
    if (!address || !window.ethereum) {
      throw new Error('Wallet not connected');
    }

    try {
      // Get user's nonce from relayer
      const nonceResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/relayer/nonce/${chainId}/${address}`
      );
      const { nonce } = await nonceResponse.json();

      // Get forwarder address
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }
      const forwarderResponse = await fetch(
        `${apiUrl}/api/relayer/forwarder/${chainId}`
      );
      if (!forwarderResponse.ok) {
        throw new Error('Failed to fetch forwarder address');
      }
      const { forwarderAddress } = await forwarderResponse.json();

      // Build forward request
      const request: ForwardRequest = {
        from: address,
        to,
        value,
        gas: gasLimit,
        nonce,
        data
      };

      // EIP-712 domain
      const domain = {
        name: 'MinimalForwarder',
        version: '0.0.1',
        chainId,
        verifyingContract: forwarderAddress
      };

      // EIP-712 types
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      };

      // Sign with EIP-712
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const signature = await signer.signTypedData(domain, types, request);

      return { request, signature };
    } catch (error) {
      console.error('Meta-transaction signing error:', error);
      return null;
    }
  };

  const relayTransaction = async (
    to: string,
    data: string,
    value: string = '0',
    gasLimit: string = '500000'
  ): Promise<MetaTxResult> => {
    setIsRelaying(true);

    try {
      // Sign the meta-transaction
      const signed = await signMetaTransaction(to, data, value, gasLimit);
      
      if (!signed) {
        return { success: false, error: 'Failed to sign meta-transaction' };
      }

      // Send to relayer
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/relayer/relay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request: signed.request,
            signature: signed.signature,
            chainId
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        return { success: true, txHash: result.txHash };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('Relay error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsRelaying(false);
    }
  };

  return {
    signMetaTransaction,
    relayTransaction,
    isRelaying
  };
}
