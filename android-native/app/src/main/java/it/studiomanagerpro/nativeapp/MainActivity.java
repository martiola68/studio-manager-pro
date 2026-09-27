package it.studiomanagerpro.nativeapp;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.*;
import android.widget.*;
import android.graphics.drawable.GradientDrawable;
import org.json.*;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private LinearLayout root, content;
    private String token, userId, studioId, userName, userEmail;
    private final int blue = Color.rgb(13,111,159), navy = Color.rgb(11,79,125), bg = Color.rgb(244,247,251), ink = Color.rgb(12,26,48);
    private final SimpleDateFormat dayFmt = new SimpleDateFormat("yyyy-MM-dd", Locale.ITALY);

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(navy);
        token = getPreferences(MODE_PRIVATE).getString("token", null);
        userId = getPreferences(MODE_PRIVATE).getString("userId", null);
        studioId = getPreferences(MODE_PRIVATE).getString("studioId", null);
        userName = getPreferences(MODE_PRIVATE).getString("userName", "");
        userEmail = getPreferences(MODE_PRIVATE).getString("userEmail", "");
        if (token == null) showLogin(); else showHome();
    }

    private TextView text(String value, int sp, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value); v.setTextSize(sp); v.setTextColor(ink);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        v.setPadding(dp(4),dp(4),dp(4),dp(4));
        return v;
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable g=new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(radius)); return g;
    }

    private Button button(String label, boolean primary) {
        Button b=new Button(this);
        b.setText(label); b.setTextSize(16); b.setAllCaps(false); b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setTextColor(primary?Color.WHITE:navy); b.setBackground(rounded(primary?blue:Color.WHITE,16));
        b.setPadding(dp(16),dp(10),dp(16),dp(10));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(56)); lp.setMargins(0,dp(6),0,dp(6)); b.setLayoutParams(lp);
        return b;
    }

    private void baseScreen(String title, boolean back) {
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(bg);
        setContentView(root);
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setPadding(dp(16),dp(14),dp(16),dp(14)); top.setBackgroundColor(navy);
        if(back){
            Button x=new Button(this); x.setText("‹"); x.setTextSize(30); x.setTextColor(Color.WHITE); x.setBackgroundColor(Color.TRANSPARENT);
            x.setOnClickListener(v->showHome()); top.addView(x,new LinearLayout.LayoutParams(dp(54),dp(54)));
        }
        TextView t=text(title,22,true); t.setTextColor(Color.WHITE); top.addView(t,new LinearLayout.LayoutParams(0,-2,1));
        root.addView(top);
        ScrollView sv=new ScrollView(this); content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18),dp(18),dp(18),dp(28)); sv.addView(content); root.addView(sv,new LinearLayout.LayoutParams(-1,0,1));
    }

    private void showLogin() {
        baseScreen("Studio Manager Pro",false);
        content.addView(new Space(this),new LinearLayout.LayoutParams(1,dp(30)));
        content.addView(text("Accedi a SMP",30,true));
        TextView sub=text("La tua area di lavoro, progettata per Android.",16,false); sub.setTextColor(Color.DKGRAY); content.addView(sub);

        EditText email=new EditText(this); email.setHint("Email"); email.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS); email.setSingleLine(); styleInput(email); content.addView(email);
        EditText pass=new EditText(this); pass.setHint("Password");
        pass.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pass.setTransformationMethod(PasswordTransformationMethod.getInstance());
        pass.setSingleLine(); styleInput(pass); content.addView(pass);

        Button go=button("Accedi",true); content.addView(go);
        TextView status=text("",14,false); content.addView(status);

        go.setOnClickListener(v->{
            String e=email.getText().toString().trim(), p=pass.getText().toString();
            if(e.isEmpty()||p.isEmpty()){status.setText("Inserisci email e password.");return;}
            go.setEnabled(false); status.setText("Accesso in corso…");
            io.execute(()->{
                try{
                    JSONObject auth=SupabaseClient.login(e,p);
                    String tok=auth.getString("access_token");
                    JSONArray rows=SupabaseClient.select(tok,"tbutenti","select=id,nome,cognome,studio_id,tipo_utente,attivo&email=eq."+SupabaseClient.eq(e)+"&limit=1");
                    if(rows.length()==0) throw new Exception("Profilo utente SMP non trovato");
                    JSONObject u=rows.getJSONObject(0);
                    String name=(u.optString("nome")+" "+u.optString("cognome")).trim();
                    token=tok; userId=u.optString("id"); studioId=u.optString("studio_id"); userName=name; userEmail=e;
                    getPreferences(MODE_PRIVATE).edit().putString("token",token).putString("userId",userId).putString("studioId",studioId).putString("userName",userName).putString("userEmail",userEmail).apply();
                    runOnUiThread(this::showHome);
                }catch(Exception ex){runOnUiThread(()->{go.setEnabled(true);status.setText("Accesso non riuscito: "+friendly(ex));});}
            });
        });
    }

    private void styleInput(EditText e){
        e.setTextSize(17); e.setPadding(dp(16),0,dp(16),0); e.setBackground(rounded(Color.WHITE,14));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(58)); lp.setMargins(0,dp(10),0,dp(2)); e.setLayoutParams(lp);
    }

    private void showHome() {
        baseScreen("Studio Manager Pro",false);
        content.addView(text("Ciao "+(userName==null||userName.isEmpty()?"":userName),26,true));
        TextView sub=text("Cosa vuoi fare?",16,false); sub.setTextColor(Color.GRAY); content.addView(sub);

        String[][] items={{"Agenda","Appuntamenti e attività"},{"Rubrica","Contatti dello studio"},{"Presenze","La tua situazione giornaliera"},{"Clienti","Anagrafiche clienti"},{"Scadenze","Adempimenti e calendario"},{"AML","Antiriciclaggio"},{"Revisioni","Attività di revisione"},{"Controllo di gestione","Analisi e reporting"},{"Ammortamenti","Piani e cespiti"}};
        for(String[] it:items){
            LinearLayout card=card();
            card.addView(text(it[0],20,true));
            TextView d=text(it[1],14,false); d.setTextColor(Color.GRAY); card.addView(d);
            content.addView(card,cardLp());
            card.setOnClickListener(v->{
                switch(it[0]){
                    case "Agenda": showAgenda(); break;
                    case "Rubrica": showRubrica(); break;
                    case "Presenze": showPresenze(); break;
                    default: showComing(it[0]);
                }
            });
        }
        Button logout=button("Esci dall'account",false); content.addView(logout);
        logout.setOnClickListener(v->{getPreferences(MODE_PRIVATE).edit().clear().apply();token=null;showLogin();});
    }

    private void loading(String s){
        content.removeAllViews(); TextView t=text(s,17,false); t.setGravity(Gravity.CENTER);
        content.addView(t,new LinearLayout.LayoutParams(-1,dp(140)));
    }

    // ---------------- AGENDA ----------------

    private void showAgenda() {
        baseScreen("Agenda",true);
        Button add=button("+ Nuovo evento",true); content.addView(add);
        add.setOnClickListener(v->showNewEvent());
        TextView wait=text("Caricamento appuntamenti…",16,false); wait.setGravity(Gravity.CENTER); content.addView(wait);

        io.execute(()->{
            try{
                JSONArray arr=SupabaseClient.select(token,"tbagenda",
                    "select=id,titolo,descrizione,data_inizio,data_fine,ora_inizio,ora_fine,luogo,riunione_teams,link_teams&utente_id=eq."+SupabaseClient.eq(userId)+"&order=data_inizio.asc&limit=100");
                runOnUiThread(()->renderAgenda(arr));
            }catch(Exception ex){runOnUiThread(()->showError("Agenda",ex));}
        });
    }

    private void renderAgenda(JSONArray arr){
        content.removeAllViews();
        Button add=button("+ Nuovo evento",true); content.addView(add); add.setOnClickListener(v->showNewEvent());
        content.addView(text("I tuoi appuntamenti",24,true));

        String today=dayFmt.format(new Date());
        int shown=0;
        for(int i=0;i<arr.length();i++) try{
            JSONObject o=arr.getJSONObject(i);
            String data=clean(o.optString("data_inizio"));
            if(data.length()>=10 && data.substring(0,10).compareTo(today)<0) continue;

            String titolo=clean(o.optString("titolo"));
            if(titolo.isEmpty()) titolo=clean(o.optString("descrizione"));
            if(titolo.isEmpty()) titolo="Appuntamento";

            LinearLayout c=card(); c.addView(text(titolo,18,true));
            String when=data;
            if(data.length()>=10) when=data.substring(8,10)+"/"+data.substring(5,7)+"/"+data.substring(0,4);
            String ora=clean(o.optString("ora_inizio"));
            if(!ora.isEmpty()) when+="  "+ora.substring(0,Math.min(5,ora.length()));
            c.addView(text(when,15,false));

            String luogo=clean(o.optString("luogo"));
            if(!luogo.isEmpty()){TextView l=text(luogo,14,false);l.setTextColor(Color.GRAY);c.addView(l);}

            String descr=clean(o.optString("descrizione"));
            if(!descr.isEmpty() && !descr.equalsIgnoreCase(titolo)){TextView d=text(descr,14,false);d.setTextColor(Color.GRAY);c.addView(d);}

            content.addView(c,cardLp()); shown++;
        }catch(Exception ignore){}

        if(shown==0) content.addView(text("Nessun appuntamento futuro.",16,false));
    }

    private void showNewEvent() {
        baseScreen("Nuovo evento",true);
        // Override back: torna all'Agenda.
        ((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showAgenda());

        EditText title=input("Titolo");
        EditText date=input("Data (AAAA-MM-GG)");
        date.setText(dayFmt.format(new Date()));
        EditText start=input("Ora inizio (HH:mm)"); start.setText("09:00");
        EditText end=input("Ora fine (HH:mm)"); end.setText("10:00");
        EditText place=input("Luogo (facoltativo)");
        EditText desc=input("Descrizione (facoltativa)");

        content.addView(title); content.addView(date); content.addView(start); content.addView(end); content.addView(place); content.addView(desc);
        Button save=button("Salva evento",true); content.addView(save);
        TextView status=text("",14,false); content.addView(status);

        save.setOnClickListener(v->{
            String t=title.getText().toString().trim();
            String d=date.getText().toString().trim();
            String si=start.getText().toString().trim();
            String sf=end.getText().toString().trim();

            if(t.isEmpty() || !d.matches("\\d{4}-\\d{2}-\\d{2}") || !si.matches("\\d{2}:\\d{2}") || !sf.matches("\\d{2}:\\d{2}")){
                status.setText("Controlla titolo, data e orari."); return;
            }

            save.setEnabled(false); status.setText("Salvataggio…");
            io.execute(()->{
                try{
                    String offset=new SimpleDateFormat("XXX",Locale.ITALY).format(new Date());
                    JSONObject body=new JSONObject()
                        .put("titolo",t)
                        .put("descrizione",desc.getText().toString().trim().isEmpty()?JSONObject.NULL:desc.getText().toString().trim())
                        .put("data_inizio",d+"T"+si+":00"+offset)
                        .put("data_fine",d+"T"+sf+":00"+offset)
                        .put("ora_inizio",si)
                        .put("ora_fine",sf)
                        .put("tutto_giorno",false)
                        .put("utente_id",userId)
                        .put("studio_id",studioId)
                        .put("luogo",place.getText().toString().trim().isEmpty()?JSONObject.NULL:place.getText().toString().trim())
                        .put("evento_generico",true)
                        .put("riunione_teams",false)
                        .put("partecipanti",new JSONArray().put(userId))
                        .put("ricorrente",false)
                        .put("updated_at",new Date().toInstant().toString());
                    SupabaseClient.insert(token,"tbagenda",body);
                    runOnUiThread(()->{Toast.makeText(this,"Evento creato",Toast.LENGTH_SHORT).show();showAgenda();});
                }catch(Exception ex){
                    runOnUiThread(()->{save.setEnabled(true);status.setText("Errore: "+friendly(ex));});
                }
            });
        });
    }

    private EditText input(String hint){
        EditText e=new EditText(this); e.setHint(hint); e.setSingleLine(); styleInput(e); return e;
    }

    // ---------------- RUBRICA ----------------

    private void showRubrica() {
        baseScreen("Rubrica",true);
        EditText search=input("Cerca nome, cognome, email…"); content.addView(search);
        LinearLayout list=new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); content.addView(list);
        list.addView(text("Caricamento contatti…",16,false));

        io.execute(()->{
            try{
                JSONArray arr=SupabaseClient.select(token,"tbcontatti","select=id,nome,cognome,email,pec,cell,tel&studio_id=eq."+SupabaseClient.eq(studioId)+"&order=cognome.asc&limit=1000");
                runOnUiThread(()->{
                    renderContacts(list,arr,"");
                    search.addTextChangedListener(new android.text.TextWatcher(){
                        public void beforeTextChanged(CharSequence s,int a,int b,int c){}
                        public void onTextChanged(CharSequence s,int a,int b,int c){renderContacts(list,arr,s.toString());}
                        public void afterTextChanged(android.text.Editable e){}
                    });
                });
            }catch(Exception ex){runOnUiThread(()->{list.removeAllViews();list.addView(text("Errore: "+friendly(ex),14,false));});}
        });
    }

    private void renderContacts(LinearLayout list, JSONArray arr, String q){
        list.removeAllViews(); String needle=q.toLowerCase(Locale.ITALY).trim(); int shown=0;
        for(int i=0;i<arr.length();i++) try{
            JSONObject o=arr.getJSONObject(i);
            String nome=(clean(o.optString("cognome"))+" "+clean(o.optString("nome"))).trim();
            String email=clean(o.optString("email")), cell=clean(o.optString("cell")), tel=clean(o.optString("tel"));
            String hay=(nome+" "+email+" "+cell+" "+tel).toLowerCase(Locale.ITALY);
            if(!needle.isEmpty()&&!hay.contains(needle)) continue;

            LinearLayout c=card(); c.addView(text(nome.isEmpty()?"Contatto":nome,18,true));
            if(!cell.isEmpty()||!tel.isEmpty()){
                String phone=!cell.isEmpty()?cell:tel; TextView p=text("☎  "+phone,15,false); p.setTextColor(blue);
                p.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:"+phone)))); c.addView(p);
            }
            if(!email.isEmpty()){
                TextView e=text("✉  "+email,15,false); e.setTextColor(blue);
                e.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_SENDTO,Uri.parse("mailto:"+email)))); c.addView(e);
            }
            list.addView(c,cardLp()); shown++; if(shown>=150)break;
        }catch(Exception ignore){}
        if(shown==0) list.addView(text("Nessun contatto trovato.",16,false));
    }

    // ---------------- PRESENZE ----------------

    private void showPresenze() {
        baseScreen("Presenze",true); loading("Caricamento presenze…");

        Calendar now=Calendar.getInstance();
        int year=now.get(Calendar.YEAR), month=now.get(Calendar.MONTH);
        Calendar first=new GregorianCalendar(year,month,1);
        Calendar last=new GregorianCalendar(year,month,first.getActualMaximum(Calendar.DAY_OF_MONTH));

        String from=dayFmt.format(first.getTime());
        String to=dayFmt.format(last.getTime());

        io.execute(()->{
            try{
                JSONArray rows=SupabaseClient.select(token,"tbpresenze_dipendenti",
                    "select=id,data_presenza,codice_presenza,note&utente_id=eq."+SupabaseClient.eq(userId)+"&data_presenza=gte."+from+"&data_presenza=lte."+to+"&order=data_presenza.asc");
                JSONArray codes=SupabaseClient.select(token,"tbpresenze_codici",
                    "select=codice,descrizione,tipo,ordine,attivo&attivo=eq.true&order=ordine.asc");
                JSONArray holidays;
                try{
                    holidays=SupabaseClient.select(token,"tbfestivita",
                        "select=data_festivita,descrizione,tipo&data_festivita=gte."+from+"&data_festivita=lte."+to+"&tipo=in.(nazionale,locale,aziendale)");
                }catch(Exception ignore){ holidays=new JSONArray(); }

                JSONArray finalHolidays=holidays;
                runOnUiThread(()->renderPresenze(rows,codes,finalHolidays,year,month));
            }catch(Exception ex){runOnUiThread(()->showError("Presenze",ex));}
        });
    }

    private void renderPresenze(JSONArray rows, JSONArray codes, JSONArray holidays, int year, int month){
        content.removeAllViews();

        Map<String,String> saved=new HashMap<>();
        for(int i=0;i<rows.length();i++) try{
            JSONObject o=rows.getJSONObject(i); saved.put(clean(o.optString("data_presenza")),clean(o.optString("codice_presenza")));
        }catch(Exception ignore){}

        Set<String> holidayDates=new HashSet<>();
        for(int i=0;i<holidays.length();i++) try{ holidayDates.add(clean(holidays.getJSONObject(i).optString("data_festivita")).substring(0,10)); }catch(Exception ignore){}

        String[] months={"Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"};
        content.addView(text(months[month]+" "+year,26,true));
        TextView hint=text("Tocca un giorno per scegliere o modificare il codice presenza.",14,false); hint.setTextColor(Color.GRAY); content.addView(hint);

        Calendar today=Calendar.getInstance();
        Calendar maxEdit=(Calendar)today.clone(); maxEdit.add(Calendar.DAY_OF_MONTH,1);
        String maxEditKey=dayFmt.format(maxEdit.getTime());
        int maxDay=new GregorianCalendar(year,month,1).getActualMaximum(Calendar.DAY_OF_MONTH);

        for(int day=1; day<=maxDay; day++){
            Calendar cal=new GregorianCalendar(year,month,day);
            String key=dayFmt.format(cal.getTime());
            int dow=cal.get(Calendar.DAY_OF_WEEK);
            boolean nonWork=dow==Calendar.SATURDAY || dow==Calendar.SUNDAY || holidayDates.contains(key);

            String code=saved.get(key);
            if((code==null || code.isEmpty()) && nonWork) code="N";
            final String displayCode=(code==null||code.isEmpty())?"—":code;
            final boolean editable=key.compareTo(maxEditKey)<=0;

            LinearLayout c=card(); c.setOrientation(LinearLayout.HORIZONTAL); c.setGravity(Gravity.CENTER_VERTICAL);
            String[] w={"Dom","Lun","Mar","Mer","Gio","Ven","Sab"};
            LinearLayout left=new LinearLayout(this); left.setOrientation(LinearLayout.VERTICAL);
            left.addView(text(String.format(Locale.ITALY,"%02d/%02d",day,month+1),17,true));
            TextView wd=text(w[dow-1]+(holidayDates.contains(key)?" · Festivo":""),13,false); wd.setTextColor(Color.GRAY); left.addView(wd);
            c.addView(left,new LinearLayout.LayoutParams(0,-2,1));

            TextView cv=text(displayCode,18,true); cv.setTextColor(editable?blue:Color.GRAY); c.addView(cv);
            if(editable){
                c.setOnClickListener(v->showPresenceCodeDialog(key,displayCode,codes));
            }else{
                c.setAlpha(0.65f);
            }
            content.addView(c,cardLp());
        }
    }

    private void showPresenceCodeDialog(String date, String current, JSONArray codes){
        ArrayList<String> labels=new ArrayList<>();
        ArrayList<String> values=new ArrayList<>();

        for(int i=0;i<codes.length();i++) try{
            JSONObject o=codes.getJSONObject(i);
            String code=clean(o.optString("codice"));
            if(code.isEmpty()) continue;
            String desc=clean(o.optString("descrizione"));
            values.add(code);
            labels.add(desc.isEmpty()?code:(code+" · "+desc));
        }catch(Exception ignore){}

        int checked=-1;
        for(int i=0;i<values.size();i++) if(values.get(i).equals(current)) checked=i;

        new AlertDialog.Builder(this)
            .setTitle("Presenza del "+date.substring(8,10)+"/"+date.substring(5,7))
            .setSingleChoiceItems(labels.toArray(new String[0]),checked,(dialog,which)->{
                String selected=values.get(which);
                dialog.dismiss();
                savePresence(date,selected);
            })
            .setNegativeButton("Annulla",null)
            .show();
    }

    private void savePresence(String date, String code){
        Toast.makeText(this,"Salvataggio "+code+"…",Toast.LENGTH_SHORT).show();
        io.execute(()->{
            try{
                JSONObject body=new JSONObject()
                    .put("utente_id",userId)
                    .put("studio_id",studioId)
                    .put("data_presenza",date)
                    .put("codice_presenza",code)
                    .put("inserito_da",userId)
                    .put("updated_at",new Date().toInstant().toString());
                SupabaseClient.upsert(token,"tbpresenze_dipendenti",body);
                runOnUiThread(()->{Toast.makeText(this,"Presenza salvata",Toast.LENGTH_SHORT).show();showPresenze();});
            }catch(Exception ex){
                runOnUiThread(()->Toast.makeText(this,"Errore: "+friendly(ex),Toast.LENGTH_LONG).show());
            }
        });
    }

    private void showComing(String title){
        baseScreen(title,true);
        content.addView(text(title,26,true));
        content.addView(text("Sezione prevista nella versione mobile nativa. La colleghiamo progressivamente alle funzioni SMP.",16,false));
    }

    private void showError(String area, Exception ex){
        content.removeAllViews();
        content.addView(text("Non riesco a caricare "+area+".",20,true));
        TextView d=text(friendly(ex),14,false); d.setTextColor(Color.DKGRAY); content.addView(d);
        Button r=button("Riprova",true); content.addView(r);
        if(area.equals("Agenda")) r.setOnClickListener(v->showAgenda()); else r.setOnClickListener(v->showPresenze());
    }

    private LinearLayout card(){
        LinearLayout c=new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(16),dp(14),dp(16),dp(14)); c.setBackground(rounded(Color.WHITE,16)); return c;
    }

    private LinearLayout.LayoutParams cardLp(){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2); lp.setMargins(0,dp(7),0,dp(7)); return lp;
    }

    private String clean(String s){
        if(s==null || s.equalsIgnoreCase("null")) return "";
        return s.trim();
    }

    private String friendly(Exception ex){
        String m=ex.getMessage(); if(m==null)return "Errore imprevisto";
        if(m.length()>240)m=m.substring(0,240); return m;
    }

    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+0.5f);}
}
