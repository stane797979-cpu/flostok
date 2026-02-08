"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getProducts } from "@/server/actions/products";

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

interface ProductComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ProductCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = "제품을 검색하세요...",
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 제품 목록 로드 (최초 1회)
  useEffect(() => {
    if (open && !loaded) {
      setIsLoading(true);
      getProducts({ limit: 500 })
        .then((result) => {
          setProducts(
            result.products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))
          );
          setLoaded(true);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [open, loaded]);

  const selectedProduct = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedProduct
            ? `[${selectedProduct.sku}] ${selectedProduct.name}`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="SKU 또는 제품명 검색..." />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">로딩 중...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
                <CommandGroup>
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`${product.sku} ${product.name}`}
                      onSelect={() => {
                        onValueChange(product.id === value ? "" : product.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === product.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        [{product.sku}]
                      </span>
                      {product.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
