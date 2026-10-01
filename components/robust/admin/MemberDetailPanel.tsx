import { BELT_LABEL, type Promotion } from "@/lib/robust/labels";

/** 詳細パネルが表示に使う会員フィールド。親ページの Member 型の部分集合（構造的部分型で受ける） */
export type MemberDetailFields = {
  birth_date: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  sports_history: string | null;
  blood_type: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  injury_history: string | null;
  medical_notes: string | null;
};

type Props = {
  member: MemberDetailFields;
  history: Promotion[];
  historyLoading: boolean;
};

export default function MemberDetailPanel({
  member: m,
  history: detailHistory,
  historyLoading,
}: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs">
      {m.birth_date && (
        <div>
          <span className="text-zinc-500">生年月日: </span>
          <span className="text-zinc-300">{m.birth_date}</span>
        </div>
      )}
      {m.address && (
        <div>
          <span className="text-zinc-500">住所: </span>
          <span className="text-zinc-300">{m.address}</span>
        </div>
      )}
      {(m.emergency_contact_name || m.emergency_contact_phone) && (
        <div>
          <span className="text-zinc-500">緊急連絡先: </span>
          <span className="text-zinc-300">
            {m.emergency_contact_name}
            {m.emergency_contact_relation && `（${m.emergency_contact_relation}）`}
            {m.emergency_contact_phone && ` ${m.emergency_contact_phone}`}
          </span>
        </div>
      )}
      {m.sports_history && (
        <div>
          <span className="text-zinc-500">運動経歴: </span>
          <span className="text-zinc-300">{m.sports_history}</span>
        </div>
      )}
      {m.blood_type && (
        <div>
          <span className="text-zinc-500">血液型: </span>
          <span className="text-zinc-300">{m.blood_type}型</span>
        </div>
      )}
      {m.chronic_conditions && (
        <div>
          <span className="text-amber-500">持病: </span>
          <span className="text-zinc-300">{m.chronic_conditions}</span>
        </div>
      )}
      {m.allergies && (
        <div>
          <span className="text-amber-500">アレルギー: </span>
          <span className="text-zinc-300">{m.allergies}</span>
        </div>
      )}
      {m.injury_history && (
        <div>
          <span className="text-amber-500">怪我歴: </span>
          <span className="text-zinc-300">{m.injury_history}</span>
        </div>
      )}
      {m.medical_notes && (
        <div>
          <span className="text-amber-500">既往症・アレルギー（旧）: </span>
          <span className="text-zinc-300">{m.medical_notes}</span>
        </div>
      )}
      {/* 昇格履歴（依頼書 Section 10・管理画面の一覧表示） */}
      <div className="pt-2 border-t border-white/5">
        <span className="text-zinc-500">昇格履歴: </span>
        {historyLoading ? (
          <span className="text-zinc-500">読み込み中…</span>
        ) : detailHistory.length === 0 ? (
          <span className="text-zinc-500">記録なし</span>
        ) : (
          <ul className="mt-1 space-y-1">
            {detailHistory.map((pr) => (
              <li key={pr.id} className="flex items-baseline gap-2">
                <span className="text-zinc-500 tabular-nums whitespace-nowrap">
                  {new Date(pr.promoted_on).toLocaleDateString("ja-JP")}
                </span>
                <span className="text-zinc-300 whitespace-nowrap">
                  {BELT_LABEL[pr.belt] ?? pr.belt}
                  {pr.stripes > 0 ? ` ${pr.stripes}本` : ""}
                </span>
                {pr.note && (
                  <span className="text-zinc-500 truncate" title={pr.note}>
                    {pr.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
