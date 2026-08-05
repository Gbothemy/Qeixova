import Image from "next/image";

type BusinessLoadingProps = {
  title?: string;
  detail?: string;
};

export default function BusinessLoading({
  title = "Preparing business workspace",
  detail = "Syncing campaigns, wallet, submissions, and live updates.",
}: BusinessLoadingProps) {
  const status = `${title}. ${detail}`;

  return (
    <main className="businessLoadingShell" aria-live="polite" aria-busy="true">
      <section className="businessLoaderCard">
        <div className="businessLoaderMark" aria-hidden="true">
          <span className="businessLoaderRing" />
          <span className="businessLoaderCore">
            <Image src="/qeixova-icon.png" alt="" width={34} height={34} priority />
          </span>
        </div>
        <div className="businessLoaderTrack" aria-hidden="true">
          <span />
        </div>
        <span className="businessLoaderStatus">{status}</span>
      </section>
    </main>
  );
}
