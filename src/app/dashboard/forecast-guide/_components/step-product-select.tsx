'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Search, Sparkles, ArrowRight } from 'lucide-react';
import type { ProductOption } from '@/server/actions/forecast-guide';

interface StepProductSelectProps {
  products: ProductOption[];
  selectedProductId?: string;
  onSelectProduct: (productId: string) => void;
  onSkip: () => void;
}

export function StepProductSelect({
  products,
  selectedProductId,
  onSelectProduct,
  onSkip,
}: StepProductSelectProps) {
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">분석할 제품을 선택하세요</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          등록된 제품이 있으면 실제 데이터를 기반으로 더 정확한 추천을 받을 수 있습니다
        </p>
      </div>

      {products.length > 0 ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="SKU 또는 제품명으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {filtered.slice(0, 20).map((product) => (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProduct(product.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProduct(product.id);
                  }
                }}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                  selectedProductId === product.id
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {product.abcGrade && (
                    <Badge variant="outline" className="text-xs">
                      {product.abcGrade}
                    </Badge>
                  )}
                  {product.xyzGrade && (
                    <Badge variant="outline" className="text-xs">
                      {product.xyzGrade}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm">등록된 제품이 없습니다</p>
          <p className="text-xs">질문에 답변하여 일반적인 추천을 받아보세요</p>
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onSkip}>
          <Sparkles className="mr-2 h-4 w-4" />
          제품 없이 직접 답변하기
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
