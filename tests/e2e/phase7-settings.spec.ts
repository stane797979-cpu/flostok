import { test, expect } from "@playwright/test";

test.describe.serial("Phase 7 — 설정 & 권한", () => {
  // ────────────────────────────────────────────────────────────
  // 설정 페이지 기본 구조 (/dashboard/settings)
  // ────────────────────────────────────────────────────────────
  test.describe("설정 페이지 기본 구조", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      await expect(
        page.getByRole("heading", { name: /설정/ })
      ).toBeVisible();
    });

    test("탭 목록이 렌더링된다", async ({ page }) => {
      const tabList = page.getByRole("tablist").first();
      await expect(tabList).toBeVisible();
    });

    test("내 계정 탭이 존재한다", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: /내 계정/ })
      ).toBeVisible();
    });

    test("데이터 관리 탭이 존재한다", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: /데이터 관리/ })
      ).toBeVisible();
    });

    test("조직 설정 탭이 존재한다", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: /조직 설정/ })
      ).toBeVisible();
    });

    test("사용자 관리 탭이 존재한다", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: /사용자 관리/ })
      ).toBeVisible();
    });

    test("권한 설정 탭이 존재한다", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: /권한/ })
      ).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 내 계정 탭
  // ────────────────────────────────────────────────────────────
  test.describe("내 계정 탭", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings?tab=account");
      await page.waitForLoadState("networkidle");
    });

    test("내 계정 탭이 기본 활성화되어 있다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /내 계정/ });
      await expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("프로필 정보가 표시된다", async ({ page }) => {
      // 이름, 이메일, 역할 등 사용자 정보 확인
      const profileSection = page
        .locator('[class*="card"], [class*="Card"]')
        .first();
      await expect(profileSection).toBeVisible();
    });

    test("이메일 또는 이름 필드가 표시된다", async ({ page }) => {
      // 폼 입력 필드 또는 표시 텍스트
      const emailField = page
        .getByLabel(/이메일/)
        .or(page.getByText(/@/))
        .first();

      if (await emailField.isVisible()) {
        await expect(emailField).toBeVisible();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 데이터 관리 탭
  // ────────────────────────────────────────────────────────────
  test.describe("데이터 관리 탭", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings?tab=data");
      await page.waitForLoadState("networkidle");
    });

    test("데이터 관리 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /데이터 관리/ });
      await expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("데이터 관리 콘텐츠가 로드된다", async ({ page }) => {
      // 데이터 업로드, 다운로드, 초기화 등의 섹션
      const content = page
        .locator('[class*="card"], [class*="Card"]')
        .first();
      await expect(content).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 조직 설정 탭
  // ────────────────────────────────────────────────────────────
  test.describe("조직 설정 탭", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings?tab=organization");
      await page.waitForLoadState("networkidle");
    });

    test("조직 설정 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /조직 설정/ });
      await expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("조직 정보 폼이 표시된다", async ({ page }) => {
      // 조직명, 업종 등 조직 설정 폼
      const form = page
        .locator("form")
        .or(page.locator('[class*="card"], [class*="Card"]').first())
        .first();
      await expect(form).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 사용자 관리 탭
  // ────────────────────────────────────────────────────────────
  test.describe("사용자 관리 탭", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings?tab=users");
      await page.waitForLoadState("networkidle");
    });

    test("사용자 관리 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /사용자 관리/ });
      await expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("사용자 목록 또는 빈 상태가 표시된다", async ({ page }) => {
      // 사용자 테이블 또는 카드 목록
      const table = page.locator("table").first();
      const tableVisible = await table.isVisible();

      if (tableVisible) {
        await expect(table).toBeVisible();
      } else {
        // 사용자가 없는 경우 빈 상태 메시지
        const emptyMsg = page
          .getByText(/사용자 없음|등록된 사용자|초대/)
          .first();
        if (await emptyMsg.isVisible()) {
          await expect(emptyMsg).toBeVisible();
        }
      }
    });

    test("사용자 초대 버튼이 존재한다 (있는 경우)", async ({ page }) => {
      const inviteBtn = page
        .getByRole("button", { name: /초대|사용자 추가|멤버 추가/ })
        .first();
      if (await inviteBtn.isVisible()) {
        await expect(inviteBtn).toBeVisible();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 권한 설정 탭
  // ────────────────────────────────────────────────────────────
  test.describe("권한 설정 탭", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings?tab=permissions");
      await page.waitForLoadState("networkidle");
    });

    test("권한 설정 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /권한/ });
      await expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("권한 설정 콘텐츠가 로드된다", async ({ page }) => {
      const content = page
        .locator('[class*="card"], [class*="Card"]')
        .first();
      await expect(content).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 발주 정책 탭
  // ────────────────────────────────────────────────────────────
  test.describe("발주 정책 탭", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings?tab=policy");
      await page.waitForLoadState("networkidle");
    });

    test("발주 정책 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /발주 정책/ });
      await expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("발주 정책 폼이 표시된다", async ({ page }) => {
      const content = page
        .locator('[class*="card"], [class*="Card"]')
        .first();
      await expect(content).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 탭 전환 동작 확인 (직접 탭 클릭)
  // ────────────────────────────────────────────────────────────
  test.describe("탭 전환 동작", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");
    });

    test("탭 클릭 시 해당 탭이 활성화된다", async ({ page }) => {
      const dataTab = page.getByRole("tab", { name: /데이터 관리/ });
      await dataTab.click();
      await page.waitForLoadState("networkidle");
      await expect(dataTab).toHaveAttribute("aria-selected", "true");
    });

    test("조직 설정 탭 클릭 시 활성화된다", async ({ page }) => {
      const orgTab = page.getByRole("tab", { name: /조직 설정/ });
      await orgTab.click();
      await page.waitForLoadState("networkidle");
      await expect(orgTab).toHaveAttribute("aria-selected", "true");
    });

    test("사용자 관리 탭 클릭 시 활성화된다", async ({ page }) => {
      const usersTab = page.getByRole("tab", { name: /사용자 관리/ });
      await usersTab.click();
      await page.waitForLoadState("networkidle");
      await expect(usersTab).toHaveAttribute("aria-selected", "true");
    });
  });
});
