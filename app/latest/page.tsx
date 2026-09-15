import type { Metadata } from "next";
import { LatestArchive, latestMetadata } from "./archive";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return latestMetadata(1);
}

export default function LatestPage() {
  return <LatestArchive page={1} />;
}
