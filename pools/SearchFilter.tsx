import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Star } from 'lucide-react';

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showMyPoolsOnly: boolean;
  onToggleMyPools: () => void;
  myPoolsCount: number;
  totalPoolsCount: number;
}

export default function SearchFilter({
  searchTerm,
  onSearchChange,
  showMyPoolsOnly,
  onToggleMyPools,
  myPoolsCount,
  totalPoolsCount
}: SearchFilterProps) {
  const clearSearch = () => {
    onSearchChange('');
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" 
          aria-hidden="true"
        />
        <Input
          placeholder="Search by token symbol, name, or address..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
          aria-label="Search pools"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-white"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* My Pools Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={showMyPoolsOnly ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleMyPools}
          className={`${
            showMyPoolsOnly
              ? 'bg-purple-500 hover:bg-purple-600 text-white'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
          aria-pressed={showMyPoolsOnly}
          aria-label={showMyPoolsOnly ? 'Show all pools' : 'Show only my pools'}
        >
          <Star 
            className={`h-4 w-4 mr-2 ${showMyPoolsOnly ? 'fill-current' : ''}`} 
            aria-hidden="true"
          />
          My Pools
          {myPoolsCount > 0 && (
            <Badge 
              variant="secondary" 
              className={`ml-2 ${
                showMyPoolsOnly 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {myPoolsCount}
            </Badge>
          )}
        </Button>

        {/* Results Count */}
        <div className="text-sm text-gray-400 hidden sm:block">
          {showMyPoolsOnly ? (
            <span>
              {myPoolsCount} of {totalPoolsCount} pools
            </span>
          ) : searchTerm ? (
            <span>
              {totalPoolsCount} results
            </span>
          ) : (
            <span>
              {totalPoolsCount} pools
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
