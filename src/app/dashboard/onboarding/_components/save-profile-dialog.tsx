"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import type { OnboardingDataType, MappingEntry } from "@/types/onboarding";
import { DATA_TYPE_LABELS } from "@/types/onboarding";
import { saveMappingProfile } from "@/server/actions/onboarding";
import { useToast } from "@/hooks/use-toast";

interface SaveProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataType: OnboardingDataType;
  mappings: MappingEntry[];
  sourceHeaders: string[];
}

export function SaveProfileDialog({
  open,
  onOpenChange,
  dataType,
  mappings,
  sourceHeaders,
}: SaveProfileDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const mappedCount = mappings.filter((m) => m.dbField).length;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = await saveMappingProfile({
        name: name.trim(),
        description: description.trim() || undefined,
        dataType,
        mappings,
        sourceHeaders,
      });

      if (result.success) {
        toast({ title: "프로필 저장 완료", description: `"${name}" 프로필이 저장되었습니다.` });
        setName("");
        setDescription("");
        onOpenChange(false);
      } else {
        toast({
          title: "저장 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>매핑 프로필 저장</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500">
            현재 매핑 설정 ({mappedCount}개 필드)을 프로필로 저장합니다.
            <br />
            데이터 유형: {DATA_TYPE_LABELS[dataType]}
          </p>
          <div className="space-y-2">
            <Label htmlFor="profile-name">프로필 이름 *</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: A회사 제품마스터 매핑"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-desc">설명 (선택)</Label>
            <Textarea
              id="profile-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 매핑 프로필에 대한 메모"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
