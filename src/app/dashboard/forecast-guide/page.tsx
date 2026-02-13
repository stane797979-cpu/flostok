import { ForecastGuideWizard } from './_components/forecast-guide-wizard';
import { getProductListForGuide, type ProductOption } from '@/server/actions/forecast-guide';

export default async function ForecastGuidePage() {
  let products: ProductOption[] = [];
  try {
    products = await getProductListForGuide();
  } catch {
    // 빌드 시 또는 인증 실패 시 빈 배열로 폴백
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">수요예측 가이드</h1>
        <p className="mt-2 text-slate-500">
          간단한 질문에 답변하면, 최적의 예측 방법과 공급 전략을 추천해드립니다
        </p>
      </div>

      <ForecastGuideWizard products={products} />
    </div>
  );
}
