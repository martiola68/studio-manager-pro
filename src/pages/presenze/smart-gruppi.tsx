import { getSupabaseClient } from "@/lib/supabase/client";

const [isAdmin, setIsAdmin] = useState(false);
const [checkingAdmin, setCheckingAdmin] = useState(true);

useEffect(() => {
  async function checkAdmin() {
    const supabase = getSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.email) {
      setIsAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    const { data } = await supabase
      .from("tbutenti")
      .select("tipo_utente")
      .eq("email", session.user.email)
      .single();

    setIsAdmin(data?.tipo_utente === "Admin");
    setCheckingAdmin(false);
  }

  checkAdmin();
}, []);

if (checkingAdmin) return <div className="p-6">Verifica permessi...</div>;

if (!isAdmin) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Accesso non autorizzato</h1>
      <p>Questa sezione è riservata agli amministratori.</p>
    </div>
  );
}
