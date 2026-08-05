import LegalDocumentPage from "@/components/LegalDocumentPage";
import { legalDocuments } from "@/lib/legalContent";

export default function TermsPage() {
  return <LegalDocumentPage document={legalDocuments.terms} />;
}
