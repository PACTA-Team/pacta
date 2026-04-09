// TODO: migrate from Next.js - src/app/contracts/[id]/page.tsx
import { useParams } from 'react-router-dom';

export default function ContractDetailsPage() {
  const { id } = useParams<{ id: string }>();
  return <div>TODO: migrate ContractDetailsPage from Next.js (contract id: {id})</div>;
}
