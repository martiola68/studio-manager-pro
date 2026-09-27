package it.studiomanagerpro.nativeapp;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
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
        TextView v = new TextView(this); v.setText(value); v.setTextSize(sp); v.setTextColor(ink);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        v.setPadding(dp(4),dp(4),dp(4),dp(4));
        return v;
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable g=new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(radius)); return g;
    }

    private Button button(String label, boolean primary) {
        Button b=new Button(this); b.setText(label); b.setTextSize(16); b.setAllCaps(false); b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setTextColor(primary?Color.WHITE:navy); b.setBackground(rounded(primary?blue:Color.WHITE,16));
        b.setPadding(dp(16),dp(10),dp(16),dp(10));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(56)); lp.setMargins(0,dp(6),0,dp(6)); b.setLayoutParams(lp); return b;
    }

    private void baseScreen(String title, boolean back) {
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(bg);
        setContentView(root);
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setPadding(dp(16),dp(14),dp(16),dp(14)); top.setBackgroundColor(navy);
        if(back){ Button x=new Button(this); x.setText("‹"); x.setTextSize(30); x.setTextColor(Color.WHITE); x.setBackgroundColor(Color.TRANSPARENT); x.setOnClickListener(v->showHome()); top.addView(x,new LinearLayout.LayoutParams(dp(54),dp(54))); }
        TextView t=text(title,22,true); t.setTextColor(Color.WHITE); top.addView(t,new LinearLayout.LayoutParams(0,-2,1));
        root.addView(top);
        ScrollView sv=new ScrollView(this); content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(18),dp(18),dp(18),dp(28)); sv.addView(content); root.addView(sv,new LinearLayout.LayoutParams(-1,0,1));
    }

    private void showLogin() {
        baseScreen("Studio Manager Pro",false);
        Space sp=new Space(this); content.addView(sp,new LinearLayout.LayoutParams(1,dp(30)));
        TextView h=text("Accedi a SMP",30,true); content.addView(h);
        TextView sub=text("La tua area di lavoro, progettata per Android.",16,false); sub.setTextColor(Color.DKGRAY); content.addView(sub);
        EditText email=new EditText(this); email.setHint("Email"); email.setInputType(33); email.setSingleLine(); styleInput(email); content.addView(email);
        EditText pass=new EditText(this); pass.setHint("Password"); pass.setInputType(129); pass.setSingleLine(); styleInput(pass); content.addView(pass);
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

    private void styleInput(EditText e){ e.setTextSize(17); e.setPadding(dp(16),0,dp(16),0); e.setBackground(rounded(Color.WHITE,14)); LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(58)); lp.setMargins(0,dp(10),0,dp(2)); e.setLayoutParams(lp); }

    private void showHome() {
        baseScreen("Studio Manager Pro",false);
        TextView hi=text("Ciao "+(userName==null||userName.isEmpty()?"":userName),26,true); content.addView(hi);
        TextView sub=text("Cosa vuoi fare?",16,false); sub.setTextColor(Color.GRAY); content.addView(sub);
        String[][] items={{"Agenda","Appuntamenti e attività"},{"Rubrica","Contatti dello studio"},{"Presenze","La tua situazione giornaliera"},{"Clienti","Anagrafiche clienti"},{"Scadenze","Adempimenti e calendario"},{"AML","Antiriciclaggio"},{"Revisioni","Attività di revisione"},{"Controllo di gestione","Analisi e reporting"},{"Ammortamenti","Piani e cespiti"}};
        for(String[] it:items){
            LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(18),dp(16),dp(18),dp(16)); card.setBackground(rounded(Color.WHITE,18));
            card.addView(text(it[0],20,true)); TextView d=text(it[1],14,false); d.setTextColor(Color.GRAY); card.addView(d);
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2); lp.setMargins(0,dp(8),0,dp(8)); content.addView(card,lp);
            card.setOnClickListener(v->{
                switch(it[0]){
                    case "Agenda": showAgenda(); break;
                    case "Rubrica": showRubrica(); break;
                    case "Presenze": showPresenze(); break;
                    default: showComing(it[0]);
                }
            });
        }
        Button logout=button("Esci dall'account",false); content.addView(logout); logout.setOnClickListener(v->{getPreferences(MODE_PRIVATE).edit().clear().apply();token=null;showLogin();});
    }

    private void loading(String s){ content.removeAllViews(); TextView t=text(s,17,false); t.setGravity(Gravity.CENTER); content.addView(t,new LinearLayout.LayoutParams(-1,dp(140))); }

    private void showAgenda() {
        baseScreen("Agenda",true); loading("Caricamento appuntamenti…");
        io.execute(()->{
            try{
                JSONArray arr=SupabaseClient.select(token,"tbagenda","select=id,titolo,descrizione,data_inizio,data_fine,ora_inizio,ora_fine,luogo,riunione_teams,link_teams&utente_id=eq."+SupabaseClient.eq(userId)+"&order=data_inizio.asc&limit=100");
                runOnUiThread(()->renderAgenda(arr));
            }catch(Exception ex){runOnUiThread(()->showError("Agenda",ex));}
        });
    }

    private void renderAgenda(JSONArray arr){
        content.removeAllViews(); content.addView(text("I tuoi appuntamenti",24,true));
        if(arr.length()==0){content.addView(text("Nessun appuntamento disponibile.",16,false));return;}
        String today=dayFmt.format(new Date());
        for(int i=0;i<arr.length();i++) try{
            JSONObject o=arr.getJSONObject(i); String data=o.optString("data_inizio"); if(data.length()>=10 && data.substring(0,10).compareTo(today)<0) continue;
            String titolo=o.optString("titolo"); if(titolo.isEmpty()) titolo=o.optString("descrizione","Appuntamento");
            LinearLayout card=card(); card.addView(text(titolo,18,true));
            String when=(data.length()>=10?data.substring(8,10)+"/"+data.substring(5,7)+"/"+data.substring(0,4):data);
            String ora=o.optString("ora_inizio"); if(!ora.isEmpty()) when+="  "+ora.substring(0,Math.min(5,ora.length()));
            card.addView(text(when,15,false)); String luogo=o.optString("luogo"); if(!luogo.isEmpty()){TextView l=text(luogo,14,false);l.setTextColor(Color.GRAY);card.addView(l);}
            content.addView(card,cardLp());
        }catch(Exception ignore){}
    }

    private void showRubrica() {
        baseScreen("Rubrica",true);
        EditText search=new EditText(this); search.setHint("Cerca nome, cognome, email…"); search.setSingleLine(); styleInput(search); content.addView(search);
        LinearLayout list=new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); content.addView(list);
        TextView wait=text("Caricamento contatti…",16,false); list.addView(wait);
        io.execute(()->{
            try{
                JSONArray arr=SupabaseClient.select(token,"tbcontatti","select=id,nome,cognome,email,pec,cell,tel&studio_id=eq."+SupabaseClient.eq(studioId)+"&order=cognome.asc&limit=1000");
                runOnUiThread(()->{
                    renderContacts(list,arr,"");
                    search.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int b,int c){} public void onTextChanged(CharSequence s,int a,int b,int c){renderContacts(list,arr,s.toString());} public void afterTextChanged(android.text.Editable e){}});
                });
            }catch(Exception ex){runOnUiThread(()->{list.removeAllViews();list.addView(text("Errore: "+friendly(ex),14,false));});}
        });
    }

    private void renderContacts(LinearLayout list, JSONArray arr, String q){
        list.removeAllViews(); String needle=q.toLowerCase(Locale.ITALY).trim(); int shown=0;
        for(int i=0;i<arr.length();i++) try{
            JSONObject o=arr.getJSONObject(i); String nome=(o.optString("cognome")+" "+o.optString("nome")).trim(); String email=o.optString("email"); String cell=o.optString("cell"); String tel=o.optString("tel");
            String hay=(nome+" "+email+" "+cell+" "+tel).toLowerCase(Locale.ITALY); if(!needle.isEmpty()&&!hay.contains(needle))continue;
            LinearLayout c=card(); c.addView(text(nome.isEmpty()?"Contatto":nome,18,true));
            if(!cell.isEmpty()||!tel.isEmpty()){String phone=!cell.isEmpty()?cell:tel; TextView p=text("☎  "+phone,15,false);p.setTextColor(blue);p.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+phone))));c.addView(p);}
            if(!email.isEmpty()){TextView e=text("✉  "+email,15,false);e.setTextColor(blue);e.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_SENDTO,Uri.parse("mailto:"+email))));c.addView(e);}
            list.addView(c,cardLp()); shown++; if(shown>=150)break;
        }catch(Exception ignore){}
        if(shown==0) list.addView(text("Nessun contatto trovato.",16,false));
    }

    private void showPresenze() {
        baseScreen("Presenze",true); loading("Caricamento presenze…");
        String from=new SimpleDateFormat("yyyy-MM-01",Locale.ITALY).format(new Date());
        Calendar cal=Calendar.getInstance(); cal.add(Calendar.MONTH,1); cal.set(Calendar.DAY_OF_MONTH,1); cal.add(Calendar.DAY_OF_MONTH,-1); String to=dayFmt.format(cal.getTime());
        io.execute(()->{
            try{
                JSONArray arr=SupabaseClient.select(token,"tbpresenze_dipendenti","select=id,data_presenza,codice_presenza,note&utente_id=eq."+SupabaseClient.eq(userId)+"&data_presenza=gte."+from+"&data_presenza=lte."+to+"&order=data_presenza.asc");
                runOnUiThread(()->renderPresenze(arr));
            }catch(Exception ex){runOnUiThread(()->showError("Presenze",ex));}
        });
    }

    private void renderPresenze(JSONArray arr){
        content.removeAllViews();
        String today=dayFmt.format(new Date());
        content.addView(text("Oggi · "+today.substring(8,10)+"/"+today.substring(5,7)+"/"+today.substring(0,4),24,true));
        JSONObject todayRow=null; for(int i=0;i<arr.length();i++)try{JSONObject o=arr.getJSONObject(i);if(today.equals(o.optString("data_presenza"))){todayRow=o;break;}}catch(Exception ignore){}
        TextView state=text(todayRow==null?"Presenza non ancora registrata":"Codice registrato: "+todayRow.optString("codice_presenza"),17,true); content.addView(state);
        Button mark=button("Segna presenza in ufficio",true); content.addView(mark);
        mark.setOnClickListener(v->{mark.setEnabled(false); io.execute(()->{try{
            JSONObject body=new JSONObject().put("utente_id",userId).put("studio_id",studioId).put("data_presenza",today).put("codice_presenza","N");
            SupabaseClient.upsert(token,"tbpresenze_dipendenti",body); runOnUiThread(()->{Toast.makeText(this,"Presenza registrata",Toast.LENGTH_SHORT).show();showPresenze();});
        }catch(Exception ex){runOnUiThread(()->{mark.setEnabled(true);Toast.makeText(this,"Errore: "+friendly(ex),Toast.LENGTH_LONG).show();});}});});
        content.addView(text("Questo mese",20,true));
        for(int i=0;i<arr.length();i++)try{JSONObject o=arr.getJSONObject(i); LinearLayout c=card(); c.setOrientation(LinearLayout.HORIZONTAL); String d=o.optString("data_presenza"); c.addView(text(d.length()>=10?d.substring(8,10)+"/"+d.substring(5,7):d,16,true),new LinearLayout.LayoutParams(0,-2,1)); TextView code=text(o.optString("codice_presenza","—"),16,true);code.setTextColor(blue);c.addView(code);content.addView(c,cardLp());}catch(Exception ignore){}
    }

    private void showComing(String title){ baseScreen(title,true); content.addView(text(title,26,true)); content.addView(text("Sezione prevista nella versione mobile nativa. La colleghiamo dopo aver validato Agenda, Rubrica e Presenze.",16,false)); }

    private void showError(String area, Exception ex){ content.removeAllViews(); content.addView(text("Non riesco a caricare "+area+".",20,true)); TextView d=text(friendly(ex),14,false);d.setTextColor(Color.DKGRAY);content.addView(d); Button r=button("Riprova",true);content.addView(r); if(area.equals("Agenda"))r.setOnClickListener(v->showAgenda());else r.setOnClickListener(v->showPresenze()); }

    private LinearLayout card(){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(dp(16),dp(14),dp(16),dp(14));c.setBackground(rounded(Color.WHITE,16));return c;}
    private LinearLayout.LayoutParams cardLp(){LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(7),0,dp(7));return lp;}
    private String friendly(Exception ex){String m=ex.getMessage(); if(m==null)return "Errore imprevisto"; if(m.length()>220)m=m.substring(0,220); return m;}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+0.5f);}
}
