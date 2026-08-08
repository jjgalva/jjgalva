import RunView from "@/components/RunView";

export default function RunPage({ params }: { params: { id: string } }) {
  return <RunView id={params.id} />;
}
