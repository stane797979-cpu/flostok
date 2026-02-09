/**
 * FlowStok 필드 정의 레지스트리
 *
 * 5가지 데이터 유형별 대상 필드 정의.
 * 기존 product-import.ts / sales-import.ts의 COLUMN_ALIASES를 통합.
 */

import type { OnboardingDataType, FlowStokField } from "@/types/onboarding";

export const FIELD_DEFINITIONS: Record<OnboardingDataType, FlowStokField[]> = {
  products: [
    {
      dbField: "sku",
      label: "SKU",
      description: "제품 고유 식별 코드",
      required: true,
      type: "text",
      aliases: [
        "SKU", "sku", "품목코드", "제품코드", "상품코드", "품번",
        "Item Code", "Product Code", "ItemCode", "ProductCode",
        "자재코드", "자재번호", "물품코드", "바코드", "관리번호",
      ],
    },
    {
      dbField: "name",
      label: "제품명",
      description: "제품 이름",
      required: true,
      type: "text",
      aliases: [
        "제품명", "name", "상품명", "품명", "Name", "Product Name",
        "품목명", "ProductName", "자재명", "물품명", "아이템명",
      ],
    },
    {
      dbField: "category",
      label: "카테고리",
      description: "제품 분류",
      required: false,
      type: "text",
      aliases: [
        "카테고리", "category", "분류", "Category", "품목분류", "그룹",
        "품목구분", "품목그룹", "자재 구분", "자재구분", "상품분류", "규격",
      ],
    },
    {
      dbField: "unit",
      label: "단위",
      description: "수량 단위 (EA, BOX, KG 등)",
      required: false,
      type: "text",
      aliases: ["단위", "unit", "Unit", "UOM"],
      defaultValue: "EA",
    },
    {
      dbField: "unitPrice",
      label: "판매단가",
      description: "판매 단가 (원)",
      required: false,
      type: "number",
      aliases: [
        "판매단가", "unitPrice", "판매가", "UnitPrice", "Price",
        "단가", "매출단가",
      ],
      defaultValue: 0,
    },
    {
      dbField: "costPrice",
      label: "원가",
      description: "매입 원가 (원)",
      required: false,
      type: "number",
      aliases: [
        "원가", "costPrice", "매입가", "CostPrice", "Cost",
        "매입단가", "구매단가",
      ],
      defaultValue: 0,
    },
    {
      dbField: "currentStock",
      label: "재고수량",
      description: "현재 보유 재고 수량",
      required: false,
      type: "number",
      aliases: [
        "재고수량", "currentStock", "현재고", "재고", "수량",
        "Stock", "Qty", "보유수량", "현재고량", "잔고", "잔량",
      ],
    },
    {
      dbField: "safetyStock",
      label: "안전재고",
      description: "최소 유지 재고 수량",
      required: false,
      type: "number",
      aliases: [
        "안전재고", "safetyStock", "SafetyStock", "최소재고", "SS",
        "적정재고", "적정재고량", "기준재고", "최소보유량",
      ],
      defaultValue: 0,
    },
    {
      dbField: "leadTime",
      label: "리드타임",
      description: "발주~입고까지 소요일 (일)",
      required: false,
      type: "number",
      aliases: ["리드타임", "leadTime", "LeadTime", "LT", "납기일수", "소요일"],
      defaultValue: 7,
    },
    {
      dbField: "moq",
      label: "MOQ",
      description: "최소 발주 수량",
      required: false,
      type: "number",
      aliases: ["MOQ", "moq", "최소발주수량", "최소주문수량"],
      defaultValue: 1,
    },
  ],

  sales: [
    {
      dbField: "sku",
      label: "SKU",
      description: "제품 식별 코드 (제품 테이블과 매칭)",
      required: true,
      type: "text",
      aliases: [
        "SKU", "sku", "품목코드", "제품코드", "상품코드", "품번",
        "자재코드", "관리번호",
      ],
    },
    {
      dbField: "date",
      label: "날짜",
      description: "판매/출고 일자 (YYYY-MM-DD)",
      required: true,
      type: "date",
      aliases: [
        "날짜", "date", "판매일", "출고일", "일자", "Date",
        "거래일", "거래일자", "판매일자", "출고일자", "매출일",
      ],
    },
    {
      dbField: "quantity",
      label: "수량",
      description: "판매/출고 수량",
      required: true,
      type: "number",
      aliases: [
        "수량", "quantity", "판매수량", "출고수량", "Quantity", "Qty",
      ],
    },
    {
      dbField: "unitPrice",
      label: "단가",
      description: "판매 단가 (원)",
      required: false,
      type: "number",
      aliases: [
        "단가", "unitPrice", "판매단가", "UnitPrice", "Price",
      ],
    },
    {
      dbField: "channel",
      label: "채널",
      description: "판매 채널 (온라인, 오프라인 등)",
      required: false,
      type: "text",
      aliases: ["채널", "channel", "판매채널", "Channel", "거래처"],
    },
    {
      dbField: "outboundType",
      label: "출고유형",
      description: "판매/폐기/이동/반품/샘플/조정",
      required: false,
      type: "text",
      aliases: [
        "출고유형", "유형", "outboundType", "type", "Type", "구분",
      ],
    },
    {
      dbField: "notes",
      label: "비고",
      description: "추가 메모",
      required: false,
      type: "text",
      aliases: ["비고", "notes", "메모", "Notes", "Memo", "참고사항"],
    },
  ],

  inventory: [
    {
      dbField: "sku",
      label: "SKU",
      description: "제품 식별 코드",
      required: true,
      type: "text",
      aliases: [
        "SKU", "sku", "품목코드", "제품코드", "상품코드", "품번",
        "자재코드", "관리번호",
      ],
    },
    {
      dbField: "currentStock",
      label: "현재고",
      description: "현재 보유 수량",
      required: true,
      type: "number",
      aliases: [
        "현재고", "currentStock", "재고수량", "재고", "수량",
        "Stock", "Qty", "보유수량", "현재고량", "잔고", "잔량",
      ],
    },
    {
      dbField: "availableStock",
      label: "가용재고",
      description: "출고 가능 수량 (현재고 - 예약)",
      required: false,
      type: "number",
      aliases: [
        "가용재고", "availableStock", "가용수량", "Available",
      ],
    },
    {
      dbField: "reservedStock",
      label: "예약재고",
      description: "출고 예약 수량",
      required: false,
      type: "number",
      aliases: [
        "예약재고", "reservedStock", "예약수량", "Reserved",
      ],
    },
    {
      dbField: "location",
      label: "적치위치",
      description: "창고 내 보관 위치",
      required: false,
      type: "text",
      aliases: [
        "적치위치", "location", "위치", "Location", "창고", "보관위치",
        "보관장소", "로케이션",
      ],
    },
  ],

  suppliers: [
    {
      dbField: "code",
      label: "공급자코드",
      description: "공급자 고유 코드",
      required: false,
      type: "text",
      aliases: [
        "공급자코드", "code", "업체코드", "Code", "SupplierCode",
        "거래처코드",
      ],
    },
    {
      dbField: "name",
      label: "공급자명",
      description: "공급자/업체 이름",
      required: true,
      type: "text",
      aliases: [
        "공급자명", "name", "업체명", "Name", "SupplierName",
        "거래처명", "회사명",
      ],
    },
    {
      dbField: "businessNumber",
      label: "사업자번호",
      description: "사업자등록번호 (XXX-XX-XXXXX)",
      required: false,
      type: "text",
      aliases: [
        "사업자번호", "businessNumber", "사업자등록번호", "BRN",
      ],
    },
    {
      dbField: "contactName",
      label: "담당자명",
      description: "거래 담당자 이름",
      required: false,
      type: "text",
      aliases: [
        "담당자명", "contactName", "담당자", "Contact", "ContactName",
      ],
    },
    {
      dbField: "contactEmail",
      label: "이메일",
      description: "담당자 이메일",
      required: false,
      type: "text",
      aliases: [
        "이메일", "contactEmail", "email", "Email", "E-mail",
      ],
    },
    {
      dbField: "contactPhone",
      label: "전화번호",
      description: "담당자 연락처",
      required: false,
      type: "text",
      aliases: [
        "전화번호", "contactPhone", "phone", "Phone", "연락처", "휴대폰",
      ],
    },
    {
      dbField: "address",
      label: "주소",
      description: "업체 주소",
      required: false,
      type: "text",
      aliases: ["주소", "address", "Address", "소재지"],
    },
    {
      dbField: "avgLeadTime",
      label: "평균 리드타임",
      description: "발주~입고 평균 소요일",
      required: false,
      type: "number",
      aliases: [
        "평균리드타임", "avgLeadTime", "리드타임", "LeadTime", "LT", "납기일수",
        "납품리드타임", "납품소요일", "조달기간",
      ],
      defaultValue: 7,
    },
    {
      dbField: "paymentTerms",
      label: "결제조건",
      description: "결제 조건 (예: 월말마감 익월말)",
      required: false,
      type: "text",
      aliases: [
        "결제조건", "paymentTerms", "Payment Terms", "지불조건",
      ],
    },
  ],

  inbound: [
    {
      dbField: "sku",
      label: "SKU",
      description: "입고 제품 식별 코드",
      required: true,
      type: "text",
      aliases: [
        "SKU", "sku", "품목코드", "제품코드", "상품코드", "품번",
        "자재코드", "관리번호",
      ],
    },
    {
      dbField: "date",
      label: "입고일",
      description: "입고 일자 (YYYY-MM-DD)",
      required: true,
      type: "date",
      aliases: [
        "입고일", "date", "날짜", "Date", "입고일자", "수입일",
        "일자", "입하일", "도착일",
      ],
    },
    {
      dbField: "expectedQuantity",
      label: "예상수량",
      description: "발주 시 예상 수량",
      required: false,
      type: "number",
      aliases: [
        "예상수량", "expectedQuantity", "발주수량", "주문수량",
        "Expected", "OrderQty",
      ],
    },
    {
      dbField: "receivedQuantity",
      label: "입고수량",
      description: "실제 입고된 수량",
      required: true,
      type: "number",
      aliases: [
        "입고수량", "receivedQuantity", "수량", "Quantity", "Qty",
        "실입고", "수입수량",
      ],
    },
    {
      dbField: "lotNumber",
      label: "LOT번호",
      description: "로트/배치 번호",
      required: false,
      type: "text",
      aliases: [
        "LOT번호", "lotNumber", "LOT", "Lot", "배치번호", "Batch",
      ],
    },
    {
      dbField: "location",
      label: "적치위치",
      description: "입고 후 보관 위치",
      required: false,
      type: "text",
      aliases: [
        "적치위치", "location", "위치", "Location", "창고", "보관위치",
        "보관장소", "입고장소", "로케이션",
      ],
    },
    {
      dbField: "notes",
      label: "비고",
      description: "추가 메모",
      required: false,
      type: "text",
      aliases: ["비고", "notes", "메모", "Notes", "Memo"],
    },
  ],
};
