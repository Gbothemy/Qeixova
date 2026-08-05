"use client";

type ContributorLoadingProps = {
  label?: string;
  detail?: string;
};

export default function ContributorLoading({
  label = "Loading contributor portal",
  detail = "Preparing your workspace",
}: ContributorLoadingProps) {
  return (
    <main className="contributorLoadingShell" aria-live="polite" aria-busy="true">
      <section className="contributorLoadingCard">
        <span className="loadingBrand">Q</span>
        <div className="loadingCopy">
          <p>{label}</p>
          <span>{detail}</span>
        </div>
        <div className="loadingTrack" aria-hidden="true">
          <span />
        </div>
      </section>

      <style jsx>{`
        .contributorLoadingShell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 20px;
          background:
            radial-gradient(circle at 50% 12%, rgba(26, 239, 34, 0.06), transparent 26%),
            var(--bg);
          color: var(--text);
        }

        .contributorLoadingCard {
          width: min(260px, 100%);
          display: grid;
          justify-items: center;
          gap: 10px;
          text-align: center;
        }

        .loadingBrand {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #050505;
          font-size: 18px;
          font-weight: 950;
        }

        .loadingCopy {
          display: grid;
          gap: 5px;
        }

        .loadingCopy p {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          font-weight: 950;
          letter-spacing: 0;
        }

        .loadingCopy span {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .loadingTrack {
          width: 120px;
          height: 3px;
          border-radius: 999px;
          background: var(--card-bg);
          overflow: hidden;
          margin-top: 3px;
        }

        .loadingTrack span {
          display: block;
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          animation: loadingSlide 1.1s ease-in-out infinite;
        }

        @keyframes loadingSlide {
          0% { transform: translateX(-105%); }
          100% { transform: translateX(245%); }
        }

        @media (min-width: 1024px) {
          .contributorLoadingShell {
            padding-left: 292px;
          }
        }

        @media (max-width: 640px) {
          .contributorLoadingShell {
            padding: 18px 18px 96px;
          }
        }
      `}</style>
    </main>
  );
}
