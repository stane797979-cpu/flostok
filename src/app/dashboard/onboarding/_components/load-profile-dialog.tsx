"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Trash2, CheckCircle2 } from "lucide-react";
import type { OnboardingDataType, MappingEntry } from "@/types/onboarding";
import { DATA_TYPE_LABELS } from "@/types/onboarding";
import {
  getMappingProfiles,
  deleteMappingProfile,
} from "@/server/actions/onboarding";
import { useToast } from "@/hooks/use-toast";

interface LoadProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataType: OnboardingDataType;
  currentHeaders: string[];
  onProfileLoaded: (mappings: MappingEntry[]) => void;
}

interface ProfileItem {
  id: string;
  name: string;
  description: string | null;
  dataType: string;
  mappings: unknown;
  sourceHeaders: unknown;
  usageCount: number | null;
  createdAt: Date;
}

export function LoadProfileDialog({
  open,
  onOpenChange,
  dataType,
  currentHeaders,
  onProfileLoaded,
}: LoadProfileDialogProps) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataType]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await getMappingProfiles(dataType);
      if (result.success) {
        setProfiles(result.data as ProfileItem[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadProfile = (profile: ProfileItem) => {
    const savedMappings = profile.mappings as MappingEntry[];
    const savedHeaders = (profile.sourceHeaders as string[]) || [];

    // 현재 헤더에 맞게 매핑 조정
    const adjustedMappings: MappingEntry[] = currentHeaders.map((header) => {
      // 저장된 매핑에서 같은 헤더 찾기
      const existing = savedMappings.find((m) => m.excelColumn === header);
      if (existing) {
        return { ...existing };
      }

      // 헤더가 없으면 빈 매핑
      return {
        excelColumn: header,
        dbField: "",
        confidence: 0,
        isAutoMapped: false,
        required: false,
      };
    });

    onProfileLoaded(adjustedMappings);
    onOpenChange(false);

    const matchCount = currentHeaders.filter((h) =>
      savedHeaders.includes(h)
    ).length;

    toast({
      title: "프로필 적용 완료",
      description: `"${profile.name}" 프로필이 적용되었습니다. (${matchCount}/${currentHeaders.length}개 헤더 일치)`,
    });
  };

  const handleDeleteProfile = async (profileId: string) => {
    const result = await deleteMappingProfile(profileId);
    if (result.success) {
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      toast({ title: "프로필 삭제 완료" });
    } else {
      toast({
        title: "삭제 실패",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  // 헤더 호환성 계산
  const getCompatibility = (profile: ProfileItem) => {
    const savedHeaders = (profile.sourceHeaders as string[]) || [];
    if (savedHeaders.length === 0 || currentHeaders.length === 0) return 0;
    const matchCount = currentHeaders.filter((h) =>
      savedHeaders.includes(h)
    ).length;
    return Math.round((matchCount / currentHeaders.length) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>매핑 프로필 불러오기</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-slate-500 mb-4">
            저장된 {DATA_TYPE_LABELS[dataType]} 매핑 프로필 목록입니다.
          </p>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>저장된 프로필이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {profiles.map((profile) => {
                const compat = getCompatibility(profile);
                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {profile.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            compat >= 70
                              ? "text-green-700 border-green-300"
                              : compat >= 40
                              ? "text-yellow-700 border-yellow-300"
                              : "text-slate-500 border-slate-300"
                          }
                        >
                          {compat}% 호환
                        </Badge>
                      </div>
                      {profile.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {profile.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteProfile(profile.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleLoadProfile(profile)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        적용
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
