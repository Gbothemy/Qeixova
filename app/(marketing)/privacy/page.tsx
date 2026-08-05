import LegalDocumentPage from "@/components/LegalDocumentPage";
import { legalDocuments } from "@/lib/legalContent";

export default function PrivacyPage() {
  return <LegalDocumentPage document={legalDocuments.privacy} />;
}
