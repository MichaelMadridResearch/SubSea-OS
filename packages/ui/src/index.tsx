import banner from "@subsea/demo-data/fixtures/banner.json";

export function FictionalBanner() {
  return <p role="status">{banner.banner}</p>;
}

export function LoadingStatus() {
  return <p role="status">Loading.</p>;
}

export function CriticalMessage({ sentence }: { sentence: string }) {
  return (
    <p role="alert" className="error" style={{ color: "var(--color-critical)" }}>
      {sentence}
    </p>
  );
}
