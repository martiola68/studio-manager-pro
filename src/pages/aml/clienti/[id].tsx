import { useRouter } from "next/router";
import AmlClienteForm from "@/components/aml/AmlClienteForm";
export default function ModificaClienteAML(){const r=useRouter();const id=typeof r.query.id==="string"?r.query.id:"";return id?<AmlClienteForm clientId={id}/>:<p className="p-8">Caricamento cliente...</p>;}
