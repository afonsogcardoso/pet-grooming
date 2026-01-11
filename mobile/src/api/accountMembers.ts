import api from "./client";

export type AccountMember = {
  id: string;
  account_id: string;
  user_id: string;
  role: string;
  status: string;
  email: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

type MembersResponse = {
  members: AccountMember[];
};

export async function getAccountMembers(): Promise<AccountMember[]> {
  const { data } = await api.get<MembersResponse>("/account/members");

  return (data.members || []).map((member: any) => ({
    id: member.id,
    account_id: member.account_id,
    user_id: member.user_id,
    role: member.role,
    status: member.status,
    email: member.email ?? null,
    displayName: member.displayName ?? null,
    firstName: member.firstName ?? null,
    lastName: member.lastName ?? null,
    avatarUrl: member.avatarUrl ?? null,
  }));
}

type InviteMemberResponse = {
  member: AccountMember;
  inviteLink?: string | null;
  inviteToken?: string | null;
};

export async function inviteAccountMember({
  email,
  role,
}: {
  email: string;
  role?: string;
}): Promise<InviteMemberResponse> {
  const { data } = await api.post<InviteMemberResponse>("/account/members/invite", {
    email,
    role,
  });

  return data;
}

export async function updateAccountMemberRole(memberId: string, role: "member" | "admin"): Promise<AccountMember> {
  const { data } = await api.patch<{ member: AccountMember }>(`/account/members/${memberId}/role`, {
    role,
  });

  return data.member;
}

export async function removeAccountMember(memberId: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(`/account/members/${memberId}`);
  return data;
}
