"use client";

import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrganizationActionsProps {
  orgId: string;
}

export function OrganizationActions({ orgId }: OrganizationActionsProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/admin/organizations/${orgId}`)}>
          <Eye className="mr-2 h-4 w-4" />
          상세 보기
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
