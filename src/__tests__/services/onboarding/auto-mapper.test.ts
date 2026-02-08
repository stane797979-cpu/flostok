import { autoMap, validateMappings } from "@/server/services/onboarding/auto-mapper";
import type { AnalyzedHeader } from "@/types/onboarding";

function makeHeader(
  name: string,
  inferredType: "text" | "number" | "date" | "unknown" = "text"
): AnalyzedHeader {
  return {
    name,
    sampleValues: [],
    inferredType,
    nullCount: 0,
    uniqueCount: 10,
  };
}

describe("autoMap", () => {
  it("정확 일치 시 confidence 100으로 매핑", () => {
    const headers = [makeHeader("SKU"), makeHeader("제품명")];
    const result = autoMap(headers, "products");

    const skuMapping = result.find((m) => m.excelColumn === "SKU");
    expect(skuMapping).toBeDefined();
    expect(skuMapping!.dbField).toBe("sku");
    expect(skuMapping!.confidence).toBe(100);
    expect(skuMapping!.isAutoMapped).toBe(true);

    const nameMapping = result.find((m) => m.excelColumn === "제품명");
    expect(nameMapping).toBeDefined();
    expect(nameMapping!.dbField).toBe("name");
    expect(nameMapping!.confidence).toBe(100);
  });

  it("대소문자 무시 일치 시 confidence 95", () => {
    const headers = [makeHeader("sku"), makeHeader("name")];
    const result = autoMap(headers, "products");

    const skuMapping = result.find((m) => m.excelColumn === "sku");
    expect(skuMapping!.dbField).toBe("sku");
    expect(skuMapping!.confidence).toBe(95);
  });

  it("별칭 포함 매칭 시 confidence 80", () => {
    const headers = [makeHeader("품목코드(SKU)"), makeHeader("상품이름")];
    const result = autoMap(headers, "products");

    // "품목코드(SKU)" contains "SKU" → 80
    const skuMapping = result.find((m) => m.excelColumn === "품목코드(SKU)");
    expect(skuMapping!.dbField).toBe("sku");
    expect(skuMapping!.confidence).toBeGreaterThanOrEqual(75);
  });

  it("매핑 안되는 컬럼은 dbField가 빈 문자열", () => {
    const headers = [makeHeader("SKU"), makeHeader("원산지")];
    const result = autoMap(headers, "products");

    const unknownMapping = result.find((m) => m.excelColumn === "원산지");
    expect(unknownMapping).toBeDefined();
    expect(unknownMapping!.dbField).toBe("");
    expect(unknownMapping!.confidence).toBe(0);
    expect(unknownMapping!.isAutoMapped).toBe(false);
  });

  it("같은 dbField에 중복 매핑 안됨", () => {
    // "SKU"와 "sku" 둘 다 sku에 매핑될 수 있지만, 하나만 매핑
    const headers = [makeHeader("SKU"), makeHeader("sku")];
    const result = autoMap(headers, "products");

    const mapped = result.filter((m) => m.dbField === "sku");
    expect(mapped).toHaveLength(1);
  });

  it("판매 데이터 매핑 - 필수 필드 포함", () => {
    const headers = [
      makeHeader("SKU"),
      makeHeader("날짜", "date"),
      makeHeader("수량", "number"),
      makeHeader("비고"),
    ];
    const result = autoMap(headers, "sales");

    expect(result.find((m) => m.excelColumn === "SKU")!.dbField).toBe("sku");
    expect(result.find((m) => m.excelColumn === "날짜")!.dbField).toBe("date");
    expect(result.find((m) => m.excelColumn === "수량")!.dbField).toBe(
      "quantity"
    );
    expect(result.find((m) => m.excelColumn === "비고")!.dbField).toBe(
      "notes"
    );
  });

  it("공급자 데이터 매핑", () => {
    const headers = [
      makeHeader("업체명"),
      makeHeader("담당자"),
      makeHeader("이메일"),
    ];
    const result = autoMap(headers, "suppliers");

    expect(result.find((m) => m.excelColumn === "업체명")!.dbField).toBe(
      "name"
    );
  });

  it("빈 헤더 배열 시 빈 결과", () => {
    const result = autoMap([], "products");
    expect(result).toHaveLength(0);
  });
});

describe("validateMappings", () => {
  it("필수 필드가 모두 매핑되면 valid: true", () => {
    const mappings = [
      {
        excelColumn: "SKU",
        dbField: "sku",
        confidence: 100,
        isAutoMapped: true,
        required: true,
      },
      {
        excelColumn: "제품명",
        dbField: "name",
        confidence: 100,
        isAutoMapped: true,
        required: true,
      },
    ];
    const result = validateMappings(mappings, "products");
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it("필수 필드가 누락되면 valid: false + missingFields 반환", () => {
    const mappings = [
      {
        excelColumn: "SKU",
        dbField: "sku",
        confidence: 100,
        isAutoMapped: true,
        required: true,
      },
      // name 필수 필드 누락
    ];
    const result = validateMappings(mappings, "products");
    expect(result.valid).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.missingFields.some((f) => f.dbField === "name")).toBe(true);
  });

  it("판매 데이터 - 필수 3개(sku, date, quantity) 검증", () => {
    const mappings = [
      {
        excelColumn: "SKU",
        dbField: "sku",
        confidence: 100,
        isAutoMapped: true,
        required: true,
      },
    ];
    const result = validateMappings(mappings, "sales");
    expect(result.valid).toBe(false);
    expect(result.missingFields.some((f) => f.dbField === "date")).toBe(true);
    expect(result.missingFields.some((f) => f.dbField === "quantity")).toBe(
      true
    );
  });
});
