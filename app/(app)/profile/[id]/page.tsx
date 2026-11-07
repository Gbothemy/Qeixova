import PublicContributorProfile from "@/components/PublicContributorProfile";

export default async function ContributorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicContributorProfile id={id} />;
}
