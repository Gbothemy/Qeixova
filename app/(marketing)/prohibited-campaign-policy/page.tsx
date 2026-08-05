import LegalDocumentPage from "@/components/LegalDocumentPage";
import { legalDocuments } from "@/lib/legalContent";

export default function ProhibitedCampaignPolicyPage() {
  return <LegalDocumentPage document={legalDocuments.prohibited} />;
}
