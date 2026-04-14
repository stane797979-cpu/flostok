/**
 * 판매 기록 시드 데이터
 *
 * ABC/XYZ 등급에 맞는 현실적인 판매 패턴 생성
 * - X등급: 안정적 (표준편차 낮음)
 * - Y등급: 계절성/변동성 있음
 * - Z등급: 불규칙 (간헐적 판매)
 */

import { db } from "../index";
import { salesRecords, type Product } from "../schema";

const SALES_CHANNELS = ["온라인몰", "오프라인", "B2B", "마켓플레이스"];

interface SalesPattern {
  baseDailyQty: number; // 기본 일평균 판매량
  stddevRatio: number; // 표준편차 비율 (0.1 = 10%)
  weekendMultiplier: number; // 주말 배수
  skipProbability: number; // 판매 없는 날 확률 (Z등급용)
}

// ABC-XYZ 조합별 판매 패턴
function getSalesPattern(abcGrade: string | null, xyzGrade: string | null): SalesPattern {
  const abc = abcGrade || "C";
  const xyz = xyzGrade || "Z";

  // 기본 판매량 (A > B > C)
  const baseQty: Record<string, number> = { A: 20, B: 10, C: 3 };

  // 변동성 (X < Y < Z)
  const stddev: Record<string, number> = { X: 0.15, Y: 0.35, Z: 0.6 };

  // 무판매 확률 (X=0, Y=0.1, Z=0.4)
  const skip: Record<string, number> = { X: 0, Y: 0.1, Z: 0.4 };

  return {
    baseDailyQty: baseQty[abc] || 3,
    stddevRatio: stddev[xyz] || 0.3,
    weekendMultiplier: xyz === "X" ? 1.0 : xyz === "Y" ? 1.3 : 0.5,
    skipProbability: skip[xyz] || 0,
  };
}

// 정규분포 근사 랜덤
function randomNormal(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(mean + z * stddev));
}

export async function seedSalesRecords(
  organizationId: string,
  productList: Product[]
): Promise<void> {
  const today = new Date();
  const DAYS_BACK = 180; // 최근 180일 (FMR 분석 6개월 기준)

  let totalRecords = 0;

  for (const product of productList) {
    const pattern = getSalesPattern(product.abcGrade, product.xyzGrade);
    let productSales = 0;

    for (let i = DAYS_BACK; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // 무판매 확률 체크
      if (Math.random() < pattern.skipProbability) {
        continue;
      }

      // 주말 확인
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const weekendFactor = isWeekend ? pattern.weekendMultiplier : 1.0;

      // 판매량 계산
      const baseQty = pattern.baseDailyQty * weekendFactor;
      const stddev = baseQty * pattern.stddevRatio;
      const quantity = Math.max(1, randomNormal(baseQty, stddev));

      if (quantity === 0) continue;

      // 채널 랜덤 선택
      const channel = SALES_CHANNELS[Math.floor(Math.random() * SALES_CHANNELS.length)];

      // 단가 (약간의 변동 - 프로모션 등)
      const priceVariation = 0.9 + Math.random() * 0.2; // 90% ~ 110%
      const unitPrice = Math.round((product.unitPrice || 10000) * priceVariation);
      const totalAmount = unitPrice * quantity;

      await db.insert(salesRecords).values({
        organizationId,
        productId: product.id,
        date: date.toISOString().split("T")[0],
        quantity,
        unitPrice,
        totalAmount,
        channel,
      });

      productSales++;
      totalRecords++;
    }

    console.log(
      `  ✓ ${product.sku}: ${productSales}건 (${product.abcGrade || "?"}${product.xyzGrade || "?"} 패턴)`
    );
  }

  console.log(`\n  📈 총 ${totalRecords}건의 판매 기록 생성`);
}
