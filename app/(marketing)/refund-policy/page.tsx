import LegalDocumentPage from "@/components/LegalDocumentPage";
import { legalDocuments } from "@/lib/legalContent";

export default function RefundPolicyPage() {
  return <LegalDocumentPage document={legalDocuments.refund} />;
}
