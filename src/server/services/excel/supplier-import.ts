/**
 * 공급자 데이터 Excel 임포트 서비스
 */

import { db } from "@/server/db";
import { suppliers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { parseExcelBuffer, sheetToJson, parseNumber } from "./parser";
import type { ExcelImportResult, ExcelImportError, SupplierExcelRow } from "./types";

let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 공급자 데이터 Excel 컬럼 매핑
 *
 * 지원하는 컬럼명:
 * - 공급자명 / name / 업체명 / 거래처명 (필수)
 * - 공급자코드 / code / 업체코드 (선택)
 * - 사업자번호 / businessNumber (선택)
 * - 담당자 / contactName / 담당자명 (선택)
 * - 이메일 / email / contactEmail (선택)
 * - 전화번호 / phone / contactPhone (선택)
 * - 주소 / address (선택)
 * - 결제조건 / paymentTerms (선택)
 * - 리드타임 / leadTime / avgLeadTime (선택)
 * - 비고 / notes / 메모 (선택)
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["공급자명", "name", "업체명", "거래처명", "공급자", "Supplier", "Name"],
  code: ["공급자코드", "code", "업체코드", "Code", "코드"],
  businessNumber: ["사업자번호", "businessNumber", "사업자등록번호", "Business Number"],
  contactName: ["담당자", "contactName", "담당자명", "Contact"],
  contactEmail: ["이메일", "email", "contactEmail", "Email", "E-mail"],
  contactPhone: ["전화번호", "phone", "contactPhone", "Phone", "Tel", "연락처"],
  address: ["주소", "address", "Address", "소재지"],
  paymentTerms: ["결제조건", "paymentTerms", "Payment Terms", "결제"],
  avgLeadTime: ["리드타임", "leadTime", "avgLeadTime", "Lead Time", "납기일수"],
  notes: ["비고", "notes", "메모", "Notes", "Memo"],
};

function getColumnValue(row: Record<string, unknown>, fieldName: string): unknown {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];
  for (const alias of aliases) {
    if (row[alias] !== undefined) {
      return row[alias];
    }
  }
  return undefined;
}

export interface ImportSupplierDataOptions {
  organizationId: string;
  buffer: ArrayBuffer;
  sheetName?: string;
  duplicateHandling?: "skip" | "update" | "error";
}

export async function importSupplierData(
  options: ImportSupplierDataOptions
): Promise<ExcelImportResult<SupplierExcelRow>> {
  const { organizationId, buffer, sheetName, duplicateHandling = "skip" } = options;

  const allErrors: ExcelImportError[] = [];
  const successData: SupplierExcelRow[] = [];

  try {
    const workbook = await parseExcelBuffer(buffer);
    const rows = await sheetToJson<Record<string, unknown>>(workbook, sheetName);

    if (rows.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: "데이터가 없습니다" }],
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
      };
    }

    // 기존 공급자 조회 (이름 기준 중복 체크)
    const existingSuppliers = await db
      .select({ id: suppliers.id, name: suppliers.name, code: suppliers.code })
      .from(suppliers)
      .where(eq(suppliers.organizationId, organizationId));
    const nameToSupplier = new Map(existingSuppliers.map((s) => [s.name, s]));
    const codeToSupplier = new Map(
      existingSuppliers.filter((s) => s.code).map((s) => [s.code!, s])
    );

    const newInsertValues: Array<typeof suppliers.$inferInsert> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // 공급자명 필수
      const name = getColumnValue(row, "name");
      if (!name || String(name).trim() === "") {
        allErrors.push({ row: rowNum, column: "공급자명", value: name, message: "공급자명이 비어있습니다" });
        continue;
      }

      const nameStr = String(name).trim();
      const codeValue = getColumnValue(row, "code");
      const codeStr = codeValue ? String(codeValue).trim() : undefined;

      // 중복 체크 (이름 또는 코드)
      const existingByName = nameToSupplier.get(nameStr);
      const existingByCode = codeStr ? codeToSupplier.get(codeStr) : undefined;
      const existing = existingByName || existingByCode;

      if (existing) {
        if (duplicateHandling === "error") {
          allErrors.push({ row: rowNum, column: "공급자명", value: nameStr, message: `중복 공급자: ${nameStr}` });
          continue;
        }
        if (duplicateHandling === "skip") {
          continue;
        }
        // update
        const contactName = getColumnValue(row, "contactName");
        const contactEmail = getColumnValue(row, "contactEmail");
        const contactPhone = getColumnValue(row, "contactPhone");
        const address = getColumnValue(row, "address");
        const businessNumber = getColumnValue(row, "businessNumber");
        const paymentTerms = getColumnValue(row, "paymentTerms");
        const leadTimeValue = getColumnValue(row, "avgLeadTime");
        const notes = getColumnValue(row, "notes");

        await db
          .update(suppliers)
          .set({
            ...(codeStr && { code: codeStr }),
            ...(businessNumber && { businessNumber: String(businessNumber).trim() }),
            ...(contactName && { contactName: String(contactName).trim() }),
            ...(contactEmail && { contactEmail: String(contactEmail).trim() }),
            ...(contactPhone && { contactPhone: String(contactPhone).trim() }),
            ...(address && { address: String(address).trim() }),
            ...(paymentTerms && { paymentTerms: String(paymentTerms).trim() }),
            ...(leadTimeValue && { avgLeadTime: parseNumber(leadTimeValue) }),
            ...(notes && { notes: String(notes).trim() }),
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, existing.id));

        successData.push({ code: codeStr || "", name: nameStr });
        continue;
      }

      // 선택 필드 파싱
      const contactName = getColumnValue(row, "contactName");
      const contactEmail = getColumnValue(row, "contactEmail");
      const contactPhone = getColumnValue(row, "contactPhone");
      const address = getColumnValue(row, "address");
      const businessNumber = getColumnValue(row, "businessNumber");
      const paymentTerms = getColumnValue(row, "paymentTerms");
      const leadTimeValue = getColumnValue(row, "avgLeadTime");
      const notes = getColumnValue(row, "notes");

      newInsertValues.push({
        organizationId,
        name: nameStr,
        code: codeStr,
        businessNumber: businessNumber ? String(businessNumber).trim() : undefined,
        contactName: contactName ? String(contactName).trim() : undefined,
        contactEmail: contactEmail ? String(contactEmail).trim() : undefined,
        contactPhone: contactPhone ? String(contactPhone).trim() : undefined,
        address: address ? String(address).trim() : undefined,
        paymentTerms: paymentTerms ? String(paymentTerms).trim() : undefined,
        avgLeadTime: leadTimeValue ? (parseNumber(leadTimeValue) ?? 7) : 7,
        notes: notes ? String(notes).trim() : undefined,
      });

      // 중복 방지: 같은 엑셀 내에서 동일 이름 재등록 방지
      nameToSupplier.set(nameStr, { id: "", name: nameStr, code: codeStr || null });

      successData.push({ code: codeStr || "", name: nameStr });
    }

    // 배치 INSERT
    if (newInsertValues.length > 0) {
      await db.insert(suppliers).values(newInsertValues);
    }

    return {
      success: allErrors.length === 0,
      data: successData,
      errors: allErrors,
      totalRows: rows.length,
      successCount: successData.length,
      errorCount: allErrors.length,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다" }],
      totalRows: 0,
      successCount: 0,
      errorCount: 1,
    };
  }
}

/**
 * 공급자 데이터 Excel 템플릿 생성
 */
export async function createSupplierTemplate(): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();

  const templateData = [
    {
      공급자명: "한국안전",
      공급자코드: "SUP-001",
      사업자번호: "123-45-67890",
      담당자: "김담당",
      이메일: "kim@example.com",
      전화번호: "02-1234-5678",
      주소: "서울시 강남구",
      결제조건: "월말마감 익월말",
      리드타임: 7,
      비고: "예시 데이터",
    },
    {
      공급자명: "글로벌물류",
      공급자코드: "SUP-002",
      사업자번호: "",
      담당자: "박대리",
      이메일: "park@example.com",
      전화번호: "031-987-6543",
      주소: "경기도 수원시",
      결제조건: "",
      리드타임: 14,
      비고: "",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet["!cols"] = [
    { wch: 15 }, // 공급자명
    { wch: 12 }, // 공급자코드
    { wch: 15 }, // 사업자번호
    { wch: 10 }, // 담당자
    { wch: 20 }, // 이메일
    { wch: 15 }, // 전화번호
    { wch: 20 }, // 주소
    { wch: 15 }, // 결제조건
    { wch: 8 },  // 리드타임
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "공급자데이터");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
