package it.studiomanagerpro.nativeapp;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.*;
import android.text.method.TransformationMethod;
import android.view.*;
import android.widget.*;
import android.graphics.drawable.GradientDrawable;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private LinearLayout root, content;
    private String token, userId, studioId, userName, userEmail;
    private boolean canManageLeave = false;
    private JSONArray agendaUsers = new JSONArray();
    private JSONArray agendaClients = new JSONArray();
    private final LinkedHashSet<String> agendaSelectedUsers = new LinkedHashSet<>();
    private final LinkedHashSet<String> agendaSelectedSectors = new LinkedHashSet<>();
    private final int blue=Color.rgb(13,111,159), navy=Color.rgb(11,79,125), bg=Color.rgb(244,247,251), ink=Color.rgb(12,26,48);
    private final SimpleDateFormat dayFmt=new SimpleDateFormat("yyyy-MM-dd",Locale.ITALY);

    @Override public void onCreate(Bundle b){
        super.onCreate(b); getWindow().setStatusBarColor(navy);
        token=getPreferences(MODE_PRIVATE).getString("token",null);
        userId=getPreferences(MODE_PRIVATE).getString("userId",null);
        studioId=getPreferences(MODE_PRIVATE).getString("studioId",null);
        userName=getPreferences(MODE_PRIVATE).getString("userName","");
        userEmail=getPreferences(MODE_PRIVATE).getString("userEmail","");
        canManageLeave=getPreferences(MODE_PRIVATE).getBoolean("canManageLeave",false);
        if(token==null) showLogin(); else { agendaSelectedUsers.add(userId); showHome(); }
    }

    private TextView text(String v,int sp,boolean bold){ TextView t=new TextView(this); t.setText(v); t.setTextSize(sp); t.setTextColor(ink); if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD); t.setPadding(dp(4),dp(4),dp(4),dp(4)); return t; }
    private GradientDrawable rounded(int color,int radius){ GradientDrawable g=new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(radius)); return g; }
    private Button button(String label,boolean primary){ Button b=new Button(this); b.setText(label); b.setTextSize(16); b.setAllCaps(false); b.setTypeface(Typeface.DEFAULT,Typeface.BOLD); b.setTextColor(primary?Color.WHITE:navy); b.setBackground(rounded(primary?blue:Color.WHITE,16)); LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(56)); lp.setMargins(0,dp(6),0,dp(6)); b.setLayoutParams(lp); return b; }
    private EditText input(String hint){ EditText e=new EditText(this); e.setHint(hint); e.setSingleLine(); e.setTextSize(17); e.setPadding(dp(16),0,dp(16),0); e.setBackground(rounded(Color.WHITE,14)); LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(58)); lp.setMargins(0,dp(8),0,dp(2)); e.setLayoutParams(lp); return e; }
    private LinearLayout card(){ LinearLayout c=new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setPadding(dp(16),dp(14),dp(16),dp(14)); c.setBackground(rounded(Color.WHITE,16)); return c; }
    private LinearLayout.LayoutParams cardLp(){ LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2); lp.setMargins(0,dp(7),0,dp(7)); return lp; }

    private void baseScreen(String title,boolean back){
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(bg); setContentView(root);
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setPadding(dp(14),dp(12),dp(12),dp(12)); top.setBackgroundColor(navy);

        if(back){
            Button x=new Button(this); x.setText("‹"); x.setTextSize(30); x.setTextColor(Color.WHITE); x.setBackgroundColor(Color.TRANSPARENT);
            x.setOnClickListener(v->showHome()); top.addView(x,new LinearLayout.LayoutParams(dp(50),dp(50)));
        }

        boolean homeHeader="Studio Manager Pro".equals(title) && !back;
        if(homeHeader){
            ImageView logo=new ImageView(this);
            logo.setImageResource(R.drawable.logo_smp);
            logo.setScaleType(ImageView.ScaleType.CENTER_CROP);
            LinearLayout.LayoutParams lpLogo=new LinearLayout.LayoutParams(dp(58),dp(42));
            lpLogo.setMargins(0,0,dp(10),0);
            top.addView(logo,lpLogo);
        }

        TextView t=text(title,22,true); t.setTextColor(Color.WHITE); top.addView(t,new LinearLayout.LayoutParams(0,-2,1));

        if(homeHeader){
            ImageButton logout=new ImageButton(this);
            logout.setImageResource(R.drawable.ic_logout);
            logout.setBackgroundColor(Color.TRANSPARENT);
            logout.setColorFilter(Color.WHITE);
            logout.setPadding(dp(10),dp(10),dp(10),dp(10));
            logout.setContentDescription("Esci dall'account");
            logout.setOnClickListener(v->{
                new AlertDialog.Builder(this)
                    .setTitle("Esci dall'account")
                    .setMessage("Vuoi uscire da Studio Manager Pro?")
                    .setNegativeButton("Annulla",null)
                    .setPositiveButton("Esci",(d,w)->{
                        getPreferences(MODE_PRIVATE).edit().clear().apply();
                        token=null;
                        showLogin();
                    })
                    .show();
            });
            top.addView(logout,new LinearLayout.LayoutParams(dp(58),dp(58)));
        }

        root.addView(top);
        ScrollView sv=new ScrollView(this); content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(18),dp(18),dp(18),dp(28)); sv.addView(content); root.addView(sv,new LinearLayout.LayoutParams(-1,0,1));
    }

    private static class BulletTransformation implements TransformationMethod {
        public CharSequence getTransformation(final CharSequence source, View view){
            return new CharSequence(){
                public int length(){ return source.length(); }
                public char charAt(int i){ return '•'; }
                public CharSequence subSequence(int start,int end){ StringBuilder s=new StringBuilder(); for(int i=start;i<end;i++)s.append('•'); return s.toString(); }
                public String toString(){ StringBuilder s=new StringBuilder(); for(int i=0;i<source.length();i++)s.append('•'); return s.toString(); }
            };
        }
        public void onFocusChanged(View view, CharSequence sourceText, boolean focused, int direction, android.graphics.Rect previouslyFocusedRect){}
    }

    private void showLogin(){
        baseScreen("Studio Manager Pro",false); content.addView(new Space(this),new LinearLayout.LayoutParams(1,dp(30)));
        content.addView(text("Accedi a SMP",30,true)); TextView sub=text("La tua area di lavoro, progettata per Android.",16,false); sub.setTextColor(Color.DKGRAY); content.addView(sub);
        EditText email=input("Email"); email.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS); content.addView(email);
        EditText pass=input("Password"); pass.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD); pass.setTransformationMethod(new BulletTransformation()); content.addView(pass);
        Button go=button("Accedi",true); content.addView(go); TextView status=text("",14,false); content.addView(status);
        go.setOnClickListener(v->{ String e=email.getText().toString().trim(), p=pass.getText().toString(); if(e.isEmpty()||p.isEmpty()){status.setText("Inserisci email e password.");return;} go.setEnabled(false); status.setText("Accesso in corso…");
            io.execute(()->{ try{ JSONObject auth=SupabaseClient.login(e,p); String tok=auth.getString("access_token"); JSONArray rows=SupabaseClient.select(tok,"tbutenti","select=id,nome,cognome,studio_id,tipo_utente,attivo,responsabile_paghe,responsabile_ferie_permessi&email=eq."+SupabaseClient.eq(e)+"&limit=1"); if(rows.length()==0)throw new Exception("Profilo utente SMP non trovato"); JSONObject u=rows.getJSONObject(0); token=tok; userId=u.optString("id"); studioId=u.optString("studio_id"); userName=(u.optString("nome")+" "+u.optString("cognome")).trim(); userEmail=e; canManageLeave=u.optBoolean("responsabile_paghe")||u.optBoolean("responsabile_ferie_permessi"); getPreferences(MODE_PRIVATE).edit().putString("token",token).putString("userId",userId).putString("studioId",studioId).putString("userName",userName).putString("userEmail",userEmail).putBoolean("canManageLeave",canManageLeave).apply(); agendaSelectedUsers.clear(); agendaSelectedUsers.add(userId); runOnUiThread(this::showHome); }catch(Exception ex){ runOnUiThread(()->{go.setEnabled(true);status.setText("Accesso non riuscito: "+friendly(ex));}); }});
        });
    }

    private void showHome(){
        baseScreen("Studio Manager Pro",false); content.addView(text("Ciao "+userName,26,true)); TextView sub=text("Cosa vuoi fare?",16,false);sub.setTextColor(Color.GRAY);content.addView(sub);
        String[][] items={{"Agenda","Appuntamenti e attività"},{"Rubrica","Contatti dello studio"},{"Presenze","Presenze, ferie e permessi"},{"Clienti","Anagrafiche clienti"},{"Soci e organi sociali","Soci, amministratori e organi di controllo"},{"Gruppi societari","Partecipazioni e struttura dei gruppi"},{"Promemoria","Attività e scadenze da ricordare"}};
        for(String[] it:items){ LinearLayout c=card(); c.addView(text(it[0],20,true)); TextView d=text(it[1],14,false);d.setTextColor(Color.GRAY);c.addView(d);content.addView(c,cardLp()); c.setOnClickListener(v->{ switch(it[0]){case "Agenda":showAgenda();break;case "Rubrica":showRubrica();break;case "Presenze":showPresenze();break;case "Clienti":showClienti();break;case "Soci e organi sociali":showSociOrgani();break;case "Gruppi societari":showGruppiSocietari();break;case "Promemoria":showPromemoria();break;}}); }
    }

    // AGENDA
    private void showAgenda(){
        baseScreen("Agenda",true);
        Button add=button("+ Nuovo evento",true), filter=button("Filtra utenti / gruppi",false); content.addView(add);content.addView(filter);
        TextView wait=text("Caricamento agenda…",16,false); wait.setGravity(Gravity.CENTER); content.addView(wait);
        add.setOnClickListener(v->loadAgendaDataThenNewEvent());
        filter.setOnClickListener(v->loadAgendaDataThenFilter());
        io.execute(()->{ try{
            JSONObject payload=SupabaseClient.apiGet(token,"/api/mobile/agenda");
            agendaUsers=payload.optJSONArray("utenti"); if(agendaUsers==null)agendaUsers=new JSONArray();
            agendaClients=payload.optJSONArray("clienti"); if(agendaClients==null)agendaClients=new JSONArray();
            JSONArray ev=payload.optJSONArray("eventi"); if(ev==null)ev=new JSONArray();
            final JSONArray events=ev;
            runOnUiThread(()->renderAgenda(events));
        }catch(Exception ex){runOnUiThread(()->showError("Agenda",ex));}});
    }

    private void renderAgenda(JSONArray arr){
        content.removeAllViews(); Button add=button("+ Nuovo evento",true), filter=button(filterLabel(),false);content.addView(add);content.addView(filter);add.setOnClickListener(v->showNewEvent());filter.setOnClickListener(v->showAgendaFilter());
        content.addView(text("Appuntamenti",24,true)); String today=dayFmt.format(new Date()); int shown=0;
        for(int i=0;i<arr.length();i++)try{ JSONObject o=arr.getJSONObject(i); String data=clean(o.optString("data_inizio")); if(data.length()>=10&&data.substring(0,10).compareTo(today)<0)continue; if(!agendaEventMatches(o))continue;
            String titolo=clean(o.optString("titolo")); if(titolo.isEmpty())titolo="Appuntamento"; LinearLayout c=card();c.addView(text(titolo,18,true));
            String when=data.length()>=10?data.substring(8,10)+"/"+data.substring(5,7)+"/"+data.substring(0,4):data; String ora=clean(o.optString("ora_inizio"));if(!ora.isEmpty())when+="  "+ora.substring(0,Math.min(5,ora.length())); c.addView(text(when,15,false));
            String owner=userLabel(o.optString("utente_id")); if(!owner.isEmpty()){TextView ow=text(owner,14,false);ow.setTextColor(blue);c.addView(ow);}
            String luogo=o.optBoolean("in_sede")?"In sede"+(clean(o.optString("sala")).isEmpty()?"":" · "+clean(o.optString("sala"))):clean(o.optString("luogo")); if(!luogo.isEmpty()){TextView l=text(luogo,14,false);l.setTextColor(Color.GRAY);c.addView(l);}
            content.addView(c,cardLp());shown++;
        }catch(Exception ignore){}
        if(shown==0)content.addView(text("Nessun evento con i filtri selezionati.",16,false));
    }

    private boolean agendaEventMatches(JSONObject o){
        String uid=clean(o.optString("utente_id"));
        if(agendaSelectedUsers.isEmpty()&&agendaSelectedSectors.isEmpty())return true;
        if(agendaSelectedUsers.contains(uid))return true;
        String sector=userSector(uid); return !sector.isEmpty()&&agendaSelectedSectors.contains(sector);
    }

    private String filterLabel(){
        int n=agendaSelectedUsers.size()+agendaSelectedSectors.size(); return n==0?"Tutti gli utenti":"Filtri agenda · "+n+" selezionati";
    }

    private void loadAgendaDataThenFilter(){ if(agendaUsers.length()>0)showAgendaFilter(); else showAgenda(); }
    private void loadAgendaDataThenNewEvent(){ if(agendaUsers.length()>0)showNewEvent(); else showAgenda(); }

    private void showAgendaFilter(){
        ArrayList<String> labels=new ArrayList<>(); ArrayList<String> keys=new ArrayList<>();
        labels.add("Tutti gli utenti");keys.add("ALL");
        for(String s:new String[]{"Fiscale","Consulenza","Lavoro"}){labels.add(s);keys.add("S:"+s);}
        for(int i=0;i<agendaUsers.length();i++)try{JSONObject u=agendaUsers.getJSONObject(i);labels.add(u.optString("cognome")+" "+u.optString("nome"));keys.add("U:"+u.optString("id"));}catch(Exception ignore){}
        boolean[] checked=new boolean[labels.size()]; checked[0]=agendaSelectedUsers.isEmpty()&&agendaSelectedSectors.isEmpty();
        for(int i=1;i<keys.size();i++){String k=keys.get(i);if(k.startsWith("S:"))checked[i]=agendaSelectedSectors.contains(k.substring(2));else checked[i]=agendaSelectedUsers.contains(k.substring(2));}
        new AlertDialog.Builder(this).setTitle("Filtra agenda").setMultiChoiceItems(labels.toArray(new String[0]),checked,(d,which,isChecked)->{
            String k=keys.get(which); if("ALL".equals(k)){agendaSelectedUsers.clear();agendaSelectedSectors.clear();} else if(k.startsWith("S:")){if(isChecked)agendaSelectedSectors.add(k.substring(2));else agendaSelectedSectors.remove(k.substring(2));} else {if(isChecked)agendaSelectedUsers.add(k.substring(2));else agendaSelectedUsers.remove(k.substring(2));}
        }).setPositiveButton("Applica",(d,w)->showAgenda()).setNegativeButton("Annulla",null).show();
    }

    private void showNewEvent(){
        baseScreen("Nuovo evento",true); ((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showAgenda());
        content.addView(text("Dati evento",22,true));
        EditText title=input("Titolo"); EditText desc=input("Descrizione");
        EditText startDate=input("Data inizio (AAAA-MM-GG)"); startDate.setText(dayFmt.format(new Date()));
        EditText startTime=input("Ora inizio (HH:mm)");startTime.setText("09:00");
        EditText endDate=input("Data fine (AAAA-MM-GG)");endDate.setText(dayFmt.format(new Date()));
        EditText endTime=input("Ora fine (HH:mm)");endTime.setText("10:00");
        content.addView(title);content.addView(desc);content.addView(startDate);content.addView(startTime);content.addView(endDate);content.addView(endTime);

        CheckBox allDay=new CheckBox(this);allDay.setText("Tutto il giorno");content.addView(allDay);
        TextView orgLabel=text("Organizzatore",15,true);content.addView(orgLabel); Spinner organizer=spinnerUsers(userId);content.addView(organizer);
        TextView cliLabel=text("Cliente",15,true);content.addView(cliLabel); Spinner client=spinnerClients();content.addView(client);
        CheckBox generic=new CheckBox(this);generic.setText("Evento generico / senza cliente");content.addView(generic);
        CheckBox inOffice=new CheckBox(this);inOffice.setText("In sede");content.addView(inOffice);
        EditText room=input("Sala"); EditText place=input("Luogo (fuori sede)");content.addView(room);content.addView(place);
        Button participants=button("Partecipanti interni",false);content.addView(participants);
        EditText external=input("Partecipanti esterni (email separate da virgola)");content.addView(external);
        CheckBox teams=new CheckBox(this);teams.setText("Riunione Teams");content.addView(teams);EditText teamsLink=input("Link Teams (facoltativo)");content.addView(teamsLink);
        CheckBox recurring=new CheckBox(this);recurring.setText("Evento ricorrente");content.addView(recurring);
        EditText frequency=input("Frequenza in giorni");frequency.setText("7"); EditText duration=input("Durata ricorrenza in giorni");duration.setText("180");content.addView(frequency);content.addView(duration);

        LinkedHashSet<String> selectedParticipants=new LinkedHashSet<>(); selectedParticipants.add(userId);
        participants.setOnClickListener(v->showParticipantsDialog(selectedParticipants,participants));
        inOffice.setOnCheckedChangeListener((b,c)->{room.setEnabled(c);place.setEnabled(!c);}); room.setEnabled(false);
        generic.setOnCheckedChangeListener((b,c)->client.setEnabled(!c));

        Button save=button("Salva evento",true);content.addView(save);TextView status=text("",14,false);content.addView(status);
        save.setOnClickListener(v->{ String t=title.getText().toString().trim(), sd=startDate.getText().toString().trim(), st=startTime.getText().toString().trim(), ed=endDate.getText().toString().trim(), et=endTime.getText().toString().trim(); if(t.isEmpty()||!sd.matches("\\d{4}-\\d{2}-\\d{2}")||!ed.matches("\\d{4}-\\d{2}-\\d{2}")){status.setText("Titolo e date sono obbligatori.");return;} save.setEnabled(false);status.setText("Salvataggio…");
            io.execute(()->{try{
                String orgId=spinnerUserId(organizer); String clientId=spinnerClientId(client);
                JSONArray participantJson=new JSONArray(); for(String id:selectedParticipants)participantJson.put(id); if(!selectedParticipants.contains(orgId))participantJson.put(orgId);
                JSONArray ext=new JSONArray(); for(String e:external.getText().toString().split(",")){String x=e.trim();if(!x.isEmpty())ext.put(x);}
                String off=new SimpleDateFormat("XXX",Locale.ITALY).format(new Date());
                String startIso=allDay.isChecked()?sd+"T00:00:00"+off:sd+"T"+st+":00"+off; String endIso=allDay.isChecked()?ed+"T23:59:59"+off:ed+"T"+et+":00"+off;
                JSONObject body=new JSONObject().put("titolo",t).put("descrizione",emptyNull(desc.getText().toString())).put("data_inizio",startIso).put("data_fine",endIso).put("ora_inizio",allDay.isChecked()?JSONObject.NULL:st).put("ora_fine",allDay.isChecked()?JSONObject.NULL:et).put("tutto_giorno",allDay.isChecked()).put("cliente_id",(generic.isChecked()||clientId.isEmpty())?JSONObject.NULL:clientId).put("utente_id",orgId).put("in_sede",inOffice.isChecked()).put("sala",inOffice.isChecked()?emptyNull(room.getText().toString()):JSONObject.NULL).put("luogo",inOffice.isChecked()?JSONObject.NULL:emptyNull(place.getText().toString())).put("evento_generico",generic.isChecked()).put("riunione_teams",teams.isChecked()).put("link_teams",teams.isChecked()?emptyNull(teamsLink.getText().toString()):JSONObject.NULL).put("partecipanti",participantJson).put("email_partecipanti_esterni",ext).put("ricorrente",recurring.isChecked()).put("frequenza_giorni",recurring.isChecked()?parseIntSafe(frequency.getText().toString(),7):JSONObject.NULL).put("durata_giorni",recurring.isChecked()?parseIntSafe(duration.getText().toString(),180):JSONObject.NULL).put("studio_id",studioId).put("updated_at",new Date().toInstant().toString());
                SupabaseClient.insert(token,"tbagenda",body);runOnUiThread(()->{Toast.makeText(this,"Evento creato",Toast.LENGTH_SHORT).show();showAgenda();});
            }catch(Exception ex){runOnUiThread(()->{save.setEnabled(true);status.setText("Errore: "+friendly(ex));});}});
        });
    }

    private Spinner spinnerUsers(String selectedId){ Spinner s=new Spinner(this); ArrayList<String> labels=new ArrayList<>(); for(int i=0;i<agendaUsers.length();i++)try{JSONObject u=agendaUsers.getJSONObject(i);labels.add(u.optString("cognome")+" "+u.optString("nome"));}catch(Exception ignore){} s.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,labels)); for(int i=0;i<agendaUsers.length();i++)try{if(selectedId.equals(agendaUsers.getJSONObject(i).optString("id")))s.setSelection(i);}catch(Exception ignore){} return s; }
    private Spinner spinnerClients(){ Spinner s=new Spinner(this);ArrayList<String> labels=new ArrayList<>();labels.add("Nessun cliente");for(int i=0;i<agendaClients.length();i++)try{labels.add(agendaClients.getJSONObject(i).optString("ragione_sociale"));}catch(Exception ignore){}s.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,labels));return s;}
    private String spinnerUserId(Spinner s){int p=s.getSelectedItemPosition();try{return agendaUsers.getJSONObject(Math.max(0,p)).optString("id",userId);}catch(Exception e){return userId;}}
    private String spinnerClientId(Spinner s){int p=s.getSelectedItemPosition()-1;if(p<0)return "";try{return agendaClients.getJSONObject(p).optString("id");}catch(Exception e){return "";}}
    private void showParticipantsDialog(LinkedHashSet<String> selected,Button b){ArrayList<String> labels=new ArrayList<>(),ids=new ArrayList<>();boolean[] chk=new boolean[agendaUsers.length()];for(int i=0;i<agendaUsers.length();i++)try{JSONObject u=agendaUsers.getJSONObject(i);labels.add(u.optString("cognome")+" "+u.optString("nome"));ids.add(u.optString("id"));chk[i]=selected.contains(u.optString("id"));}catch(Exception ignore){}new AlertDialog.Builder(this).setTitle("Partecipanti interni").setMultiChoiceItems(labels.toArray(new String[0]),chk,(d,w,c)->{if(c)selected.add(ids.get(w));else selected.remove(ids.get(w));}).setPositiveButton("OK",(d,w)->b.setText("Partecipanti interni · "+selected.size())).show();}

    // RUBRICA
    private void showRubrica(){baseScreen("Rubrica",true);EditText search=input("Cerca nome, cognome, email…");content.addView(search);LinearLayout list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);content.addView(list);list.addView(text("Caricamento contatti…",16,false));io.execute(()->{try{JSONObject payload=SupabaseClient.apiGet(token,"/api/mobile/rubrica"); JSONArray arr=payload.optJSONArray("data"); if(arr==null)arr=new JSONArray(); final JSONArray data=arr; runOnUiThread(()->{renderContacts(list,data,"");search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int b,int c){}public void onTextChanged(CharSequence s,int a,int b,int c){renderContacts(list,data,s.toString());}public void afterTextChanged(Editable e){}});});}catch(Exception ex){runOnUiThread(()->{list.removeAllViews();list.addView(text("Errore: "+friendly(ex),14,false));});}});}
    private void renderContacts(LinearLayout list,JSONArray arr,String q){list.removeAllViews();String n=q.toLowerCase(Locale.ITALY).trim();int shown=0;for(int i=0;i<arr.length();i++)try{JSONObject o=arr.getJSONObject(i);String nome=(clean(o.optString("cognome"))+" "+clean(o.optString("nome"))).trim(),email=clean(o.optString("email")),cell=clean(o.optString("cell")),tel=clean(o.optString("tel"));if(!(nome+" "+email+" "+cell+" "+tel).toLowerCase(Locale.ITALY).contains(n))continue;LinearLayout c=card();c.addView(text(nome.isEmpty()?"Contatto":nome,18,true));if(!cell.isEmpty()||!tel.isEmpty()){String p=!cell.isEmpty()?cell:tel;TextView v=text("☎  "+p,15,false);v.setTextColor(blue);v.setOnClickListener(x->startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+p))));c.addView(v);}if(!email.isEmpty()){TextView e=text("✉  "+email,15,false);e.setTextColor(blue);e.setOnClickListener(x->startActivity(new Intent(Intent.ACTION_SENDTO,Uri.parse("mailto:"+email))));c.addView(e);}list.addView(c,cardLp());shown++;if(shown>=150)break;}catch(Exception ignore){}if(shown==0)list.addView(text("Nessun contatto trovato.",16,false));}

    // PRESENZE
    private void showPresenze(){
        baseScreen("Presenze",true);
        content.addView(text("Caricamento presenze…",16,false));
        Calendar now=Calendar.getInstance(); int y=now.get(Calendar.YEAR),m=now.get(Calendar.MONTH);
        Calendar first=new GregorianCalendar(y,m,1),last=new GregorianCalendar(y,m,first.getActualMaximum(Calendar.DAY_OF_MONTH));
        String from=dayFmt.format(first.getTime()),to=dayFmt.format(last.getTime());
        io.execute(()->{
            try{
                JSONArray profile=SupabaseClient.select(token,"tbutenti","select=responsabile_paghe,responsabile_ferie_permessi&email=eq."+SupabaseClient.eq(userEmail)+"&limit=1");
                if(profile.length()>0){
                    JSONObject p=profile.getJSONObject(0);
                    canManageLeave=p.optBoolean("responsabile_paghe")||p.optBoolean("responsabile_ferie_permessi");
                }
                try{
                    JSONArray studio=SupabaseClient.select(token,"tbstudio","select=mail_alert_ferie_permessi&id=eq."+SupabaseClient.eq(studioId)+"&limit=1");
                    if(studio.length()>0){
                        String mail=clean(studio.getJSONObject(0).optString("mail_alert_ferie_permessi")).toLowerCase(Locale.ITALY);
                        if(!mail.isEmpty()&&mail.equals(userEmail.toLowerCase(Locale.ITALY))) canManageLeave=true;
                    }
                }catch(Exception ignore){}
                getPreferences(MODE_PRIVATE).edit().putBoolean("canManageLeave",canManageLeave).apply();

                JSONObject payload=SupabaseClient.apiGet(token,"/api/mobile/presenze?from="+from+"&to="+to);
                JSONArray rows=payload.optJSONArray("presenze"); if(rows==null)rows=new JSONArray();
                JSONArray codes=payload.optJSONArray("codici"); if(codes==null)codes=new JSONArray();
                final JSONArray finalRows=rows; final JSONArray finalCodes=codes; final boolean manager=canManageLeave;
                runOnUiThread(()->renderPresenze(finalRows,finalCodes,y,m,manager));
            }catch(Exception ex){runOnUiThread(()->showError("Presenze",ex));}
        });
    }

    private void renderPresenze(JSONArray rows,JSONArray codes,int y,int m,boolean manager){
        content.removeAllViews();
        LinearLayout person=card();
        TextView name=text(userName,20,true); person.addView(name);
        TextView role=text("Dipendente / utente loggato",14,false); role.setTextColor(Color.GRAY); person.addView(role);
        content.addView(person,cardLp());

        Button request=button("Richiedi ferie / permesso",true); content.addView(request);
        request.setOnClickListener(v->showLeaveRequest());
        if(manager){
            Button manage=button("Gestione ferie / permessi",false); content.addView(manage);
            manage.setOnClickListener(v->showLeaveManagement());
        }

        Map<String,String> saved=new HashMap<>();
        for(int i=0;i<rows.length();i++)try{JSONObject o=rows.getJSONObject(i);saved.put(o.optString("data_presenza"),o.optString("codice_presenza"));}catch(Exception ignore){}
        String[] months={"Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"};
        content.addView(text(months[m]+" "+y,26,true));
        TextView h=text("Tocca un giorno lavorativo per scegliere il codice presenza.",14,false); h.setTextColor(Color.GRAY); content.addView(h);
        Calendar max=Calendar.getInstance(); max.add(Calendar.DAY_OF_MONTH,1); String maxKey=dayFmt.format(max.getTime());
        int days=new GregorianCalendar(y,m,1).getActualMaximum(Calendar.DAY_OF_MONTH);
        for(int d=1;d<=days;d++){
            Calendar c=new GregorianCalendar(y,m,d); String key=dayFmt.format(c.getTime()); int dow=c.get(Calendar.DAY_OF_WEEK);
            boolean weekend=dow==Calendar.SATURDAY||dow==Calendar.SUNDAY;
            String raw=saved.get(key); if((raw==null||raw.isEmpty())&&weekend)raw="N";
            final String selectedRaw=raw; String display=presenceDisplay(selectedRaw);
            LinearLayout row=card(); row.setOrientation(LinearLayout.HORIZONTAL); row.setGravity(Gravity.CENTER_VERTICAL);
            row.addView(text(String.format(Locale.ITALY,"%02d/%02d",d,m+1),17,true),new LinearLayout.LayoutParams(0,-2,1));
            TextView code=text(display.isEmpty()?"—":display,18,true); code.setTextColor(key.compareTo(maxKey)<=0?blue:Color.GRAY); row.addView(code);
            if(key.compareTo(maxKey)<=0&&!weekend) row.setOnClickListener(v->showPresenceCodeDialog(key,selectedRaw,codes)); else row.setAlpha(.7f);
            content.addView(row,cardLp());
        }
    }

    private void showLeaveRequest(){
        baseScreen("Richiesta ferie / permesso",true);
        ((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showPresenze());

        content.addView(text(userName,20,true));
        TextView sub=text("Inserisci la richiesta come nel gestionale SMP.",14,false); sub.setTextColor(Color.GRAY); content.addView(sub);

        Spinner type=new Spinner(this);
        type.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Ferie","Permesso"}));
        content.addView(text("Tipo richiesta",14,true)); content.addView(type);

        Spinner permitType=new Spinner(this);
        permitType.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"P","PF","104","AL"}));
        content.addView(text("Tipo permesso",14,true)); content.addView(permitType);

        EditText start=input("Data inizio (AAAA-MM-GG)"); start.setText(dayFmt.format(new Date())); content.addView(start);
        EditText end=input("Data fine (AAAA-MM-GG)"); end.setText(dayFmt.format(new Date())); content.addView(end);
        EditText time=input("Ora richiesta (HH:mm)"); time.setText("09:00"); content.addView(time);
        EditText hours=input("Ore permesso (es. 2 o 0.25)"); content.addView(hours);
        EditText reason=input("Motivazione / note"); content.addView(reason);

        Runnable sync=()->{
            boolean ferie=type.getSelectedItemPosition()==0;
            permitType.setEnabled(!ferie); time.setEnabled(!ferie); hours.setEnabled(!ferie); end.setEnabled(ferie);
        };
        type.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            public void onItemSelected(AdapterView<?> p,View v,int pos,long id){sync.run();}
            public void onNothingSelected(AdapterView<?> p){}
        });
        sync.run();

        Button send=button("Invia richiesta",true); content.addView(send);
        TextView status=text("",14,false); content.addView(status);
        send.setOnClickListener(v->{
            boolean ferie=type.getSelectedItemPosition()==0;
            String di=start.getText().toString().trim(), df=end.getText().toString().trim();
            if(!di.matches("\\d{4}-\\d{2}-\\d{2}")){status.setText("Data inizio non valida.");return;}
            if(ferie&&!df.matches("\\d{4}-\\d{2}-\\d{2}")){status.setText("Data fine non valida.");return;}
            double ore=0; if(!ferie){try{ore=Double.parseDouble(hours.getText().toString().replace(",","."));}catch(Exception e){status.setText("Inserisci le ore richieste.");return;}}
            final double finalOre=ore;
            send.setEnabled(false); status.setText("Invio richiesta…");
            io.execute(()->{
                try{
                    int giorni=ferie?countWorkingDays(di,df):0;
                    JSONObject body=new JSONObject()
                        .put("tipo_richiesta",ferie?"ferie":"permesso")
                        .put("tipo_permesso",ferie?JSONObject.NULL:String.valueOf(permitType.getSelectedItem()))
                        .put("ora_richiesta",ferie?JSONObject.NULL:time.getText().toString().trim())
                        .put("data_inizio",di)
                        .put("data_fine",ferie?df:JSONObject.NULL)
                        .put("giorni",ferie?giorni:JSONObject.NULL)
                        .put("ore",ferie?JSONObject.NULL:finalOre)
                        .put("motivazione",emptyNull(reason.getText().toString()));
                    JSONObject result=SupabaseClient.apiPost(token,"/api/payroll/ferie-permessi/richieste",body);
                    if(!result.optBoolean("success",false)) throw new Exception(result.optString("error","Errore invio richiesta"));
                    runOnUiThread(()->{Toast.makeText(this,"Richiesta inviata",Toast.LENGTH_SHORT).show();showPresenze();});
                }catch(Exception ex){runOnUiThread(()->{send.setEnabled(true);status.setText("Errore: "+friendly(ex));});}
            });
        });
    }

    private int countWorkingDays(String from,String to){
        try{
            Date a=dayFmt.parse(from),b=dayFmt.parse(to); if(a==null||b==null||b.before(a))return 0;
            Calendar c=Calendar.getInstance(); c.setTime(a); Calendar e=Calendar.getInstance(); e.setTime(b); int n=0;
            while(!c.after(e)){int d=c.get(Calendar.DAY_OF_WEEK); if(d!=Calendar.SATURDAY&&d!=Calendar.SUNDAY)n++; c.add(Calendar.DAY_OF_MONTH,1);}
            return n;
        }catch(Exception e){return 0;}
    }

    private void showLeaveManagement(){
        baseScreen("Gestione ferie / permessi",true);
        ((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showPresenze());
        content.addView(text("Caricamento richieste…",16,false));
        io.execute(()->{
            try{
                JSONArray req=SupabaseClient.select(token,"tbferie_permessi_richieste","select=id,utente_id,tipo_richiesta,tipo_permesso,ora_richiesta,data_inizio,data_fine,giorni,ore,motivazione,stato,note_responsabile,created_at&studio_id=eq."+SupabaseClient.eq(studioId)+"&order=created_at.desc&limit=300");
                JSONArray users=SupabaseClient.select(token,"tbutenti","select=id,nome,cognome,email&studio_id=eq."+SupabaseClient.eq(studioId));
                runOnUiThread(()->renderLeaveManagement(req,users));
            }catch(Exception ex){runOnUiThread(()->showError("Gestione ferie / permessi",ex));}
        });
    }

    private void renderLeaveManagement(JSONArray req,JSONArray users){
        content.removeAllViews();
        int sent=0,approved=0,rejected=0,revoked=0;
        for(int i=0;i<req.length();i++)try{
            String st=req.getJSONObject(i).optString("stato");
            if("inviata".equals(st))sent++; else if("approvata".equals(st))approved++; else if("rifiutata".equals(st))rejected++; else if("revocata".equals(st))revoked++;
        }catch(Exception ignore){}
        LinearLayout summary=card();
        summary.addView(text("Inviate: "+sent+"   ·   Approvate: "+approved,16,true));
        summary.addView(text("Rifiutate: "+rejected+"   ·   Revocate: "+revoked,15,false));
        content.addView(summary,cardLp());

        for(int i=0;i<req.length();i++)try{
            JSONObject r=req.getJSONObject(i); String id=r.optString("id"),uid=r.optString("utente_id"),st=r.optString("stato");
            LinearLayout c=card(); c.addView(text(lookupUser(users,uid),17,true));
            String tipo="ferie".equals(r.optString("tipo_richiesta"))?"Ferie":"Permesso "+clean(r.optString("tipo_permesso"));
            c.addView(text(tipo+" · "+st.toUpperCase(Locale.ITALY),14,true));
            String date=r.optString("data_inizio"); String fine=clean(r.optString("data_fine")); if(!fine.isEmpty())date+=" - "+fine;
            c.addView(text(date,14,false));
            String qty=r.optDouble("giorni",0)>0?r.optDouble("giorni")+" gg":(r.optDouble("ore",0)>0?r.optDouble("ore")+" ore":"");
            if(!qty.isEmpty())c.addView(text(qty,14,false));
            String motivo=clean(r.optString("motivazione")); if(!motivo.isEmpty()){TextView m=text("Motivo: "+motivo,14,false);m.setTextColor(Color.DKGRAY);c.addView(m);}
            if("inviata".equals(st)){
                LinearLayout actions=new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL);
                Button ok=button("Approva",true), no=button("Rifiuta",false);
                actions.addView(ok,new LinearLayout.LayoutParams(0,dp(56),1)); actions.addView(no,new LinearLayout.LayoutParams(0,dp(56),1)); c.addView(actions);
                ok.setOnClickListener(v->manageLeaveRequest(id,"approvata"));
                no.setOnClickListener(v->manageLeaveRequest(id,"rifiutata"));
            }else if("approvata".equals(st)){
                Button revoke=button("Revoca",false); c.addView(revoke); revoke.setOnClickListener(v->manageLeaveRequest(id,"revocata"));
            }
            content.addView(c,cardLp());
        }catch(Exception ignore){}
        if(req.length()==0)content.addView(text("Nessuna richiesta trovata.",16,false));
    }

    private String lookupUser(JSONArray users,String uid){
        for(int i=0;i<users.length();i++)try{JSONObject u=users.getJSONObject(i);if(uid.equals(u.optString("id")))return (u.optString("cognome")+" "+u.optString("nome")).trim();}catch(Exception ignore){}
        return "Dipendente";
    }

    private void manageLeaveRequest(String id,String action){
        io.execute(()->{
            try{
                JSONObject body=new JSONObject().put("azione",action).put("note_responsabile",JSONObject.NULL);
                JSONObject result=SupabaseClient.apiPost(token,"/api/payroll/ferie-permessi/richieste/"+id+"/gestisci",body);
                if(!result.optBoolean("success",true)&&result.has("error"))throw new Exception(result.optString("error"));
                runOnUiThread(()->{Toast.makeText(this,"Operazione completata",Toast.LENGTH_SHORT).show();showLeaveManagement();});
            }catch(Exception ex){runOnUiThread(()->Toast.makeText(this,"Errore: "+friendly(ex),Toast.LENGTH_LONG).show());}
        });
    }

    private String presenceDisplay(String raw){if(raw==null)return "";if("Pp".equals(raw))return "P";if("Ps".equals(raw))return "SW";return raw;}
    private void showPresenceCodeDialog(String date,String current,JSONArray codes){ArrayList<String> labels=new ArrayList<>(),values=new ArrayList<>();for(int i=0;i<codes.length();i++)try{JSONObject o=codes.getJSONObject(i);String raw=o.optString("codice");if(raw.isEmpty())continue;String disp=presenceDisplay(raw),desc=clean(o.optString("descrizione"));if("Pp".equals(raw))desc="Presente in ufficio";if("Ps".equals(raw))desc="Smart working";values.add(raw);labels.add(desc.isEmpty()?disp:disp+" · "+desc);}catch(Exception ignore){}int checked=-1;for(int i=0;i<values.size();i++)if(values.get(i).equals(current))checked=i;new AlertDialog.Builder(this).setTitle("Presenza del "+date.substring(8,10)+"/"+date.substring(5,7)).setSingleChoiceItems(labels.toArray(new String[0]),checked,(d,w)->{d.dismiss();savePresence(date,values.get(w));}).setNegativeButton("Annulla",null).show();}
    private void savePresence(String date,String rawCode){io.execute(()->{try{JSONObject b=new JSONObject().put("utente_id",userId).put("studio_id",studioId).put("data_presenza",date).put("codice_presenza",rawCode).put("inserito_da",userId).put("updated_at",new Date().toInstant().toString());SupabaseClient.upsert(token,"tbpresenze_dipendenti",b);runOnUiThread(()->{Toast.makeText(this,"Presenza salvata",Toast.LENGTH_SHORT).show();showPresenze();});}catch(Exception ex){runOnUiThread(()->Toast.makeText(this,"Errore: "+friendly(ex),Toast.LENGTH_LONG).show());}});}


    // CLIENTI
    private void showClienti(){
        baseScreen("Clienti",true);
        EditText search=input("Cerca ragione sociale, CF, P.IVA…"); content.addView(search);
        LinearLayout list=new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); content.addView(list);
        list.addView(text("Caricamento clienti…",16,false));
        io.execute(()->{
            try{
                JSONObject payload=SupabaseClient.apiGet(token,"/api/mobile/clienti"); JSONArray arr=payload.optJSONArray("data"); if(arr==null)arr=new JSONArray(); final JSONArray data=arr;
                runOnUiThread(()->{
                    renderClienti(list,data,"");
                    search.addTextChangedListener(new TextWatcher(){
                        public void beforeTextChanged(CharSequence x,int a,int b,int c){}
                        public void onTextChanged(CharSequence x,int a,int b,int c){renderClienti(list,data,x.toString());}
                        public void afterTextChanged(Editable e){}
                    });
                });
            }catch(Exception ex){runOnUiThread(()->{list.removeAllViews();list.addView(text("Errore: "+friendly(ex),14,false));});}
        });
    }

    private void renderClienti(LinearLayout list,JSONArray arr,String query){
        list.removeAllViews(); String q=query.trim().toLowerCase(Locale.ITALY); int shown=0;
        for(int i=0;i<arr.length();i++)try{
            JSONObject o=arr.getJSONObject(i);
            String name=clean(o.optString("ragione_sociale")); if(name.isEmpty()) name=(clean(o.optString("cognome"))+" "+clean(o.optString("nome"))).trim();
            String cf=clean(o.optString("codice_fiscale")),piva=clean(o.optString("partita_iva")),cod=clean(o.optString("cod_cliente"));
            String hay=(name+" "+cf+" "+piva+" "+cod).toLowerCase(Locale.ITALY); if(!q.isEmpty()&&!hay.contains(q))continue;
            LinearLayout c=card(); c.addView(text(name.isEmpty()?"Cliente":name,18,true));
            String meta=(cod.isEmpty()?"":cod+" · ")+(cf.isEmpty()?piva:cf); if(!meta.isEmpty()){TextView m=text(meta,14,false);m.setTextColor(Color.GRAY);c.addView(m);}
            ArrayList<String> sett=new ArrayList<>(); if(o.optBoolean("settore_fiscale"))sett.add("Fiscale"); if(o.optBoolean("settore_lavoro"))sett.add("Lavoro"); if(o.optBoolean("settore_consulenza"))sett.add("Consulenza");
            if(!sett.isEmpty()){TextView st=text(android.text.TextUtils.join(" · ",sett),13,true);st.setTextColor(blue);c.addView(st);}
            final JSONObject item=o; c.setOnClickListener(v->showClienteDetail(item)); list.addView(c,cardLp()); shown++;
        }catch(Exception ignore){}
        if(shown==0)list.addView(text("Nessun cliente trovato.",16,false));
    }

    private void showClienteDetail(JSONObject o){
        baseScreen("Scheda cliente",true); ((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showClienti());
        String name=clean(o.optString("ragione_sociale")); if(name.isEmpty())name=(clean(o.optString("cognome"))+" "+clean(o.optString("nome"))).trim();
        content.addView(text(name,25,true));
        addDetail("Codice cliente",clean(o.optString("cod_cliente")));
        addDetail("Tipo",clean(o.optString("tipo_cliente")));
        addDetail("Codice fiscale",clean(o.optString("codice_fiscale")));
        addDetail("Partita IVA",clean(o.optString("partita_iva")));
        addDetail("Email",clean(o.optString("email")));
        addDetail("PEC",clean(o.optString("pec")));
        addDetail("Telefono",clean(o.optString("telefono")));
        String city=(clean(o.optString("citta"))+" "+clean(o.optString("provincia"))).trim(); addDetail("Località",city);
        addDetail("Stato",o.optBoolean("attivo")?"Attivo":"Inattivo");
    }

    private void addDetail(String label,String value){
        if(value==null||value.isEmpty())return; LinearLayout c=card(); TextView l=text(label,13,true);l.setTextColor(Color.GRAY);c.addView(l);c.addView(text(value,17,false));content.addView(c,cardLp());
    }

    // SOCI E ORGANI SOCIALI
    private void showSociOrgani(){
        baseScreen("Soci e organi sociali",true);
        EditText search=input("Cerca società…"); content.addView(search);
        LinearLayout list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);content.addView(list);
        list.addView(text("Caricamento società…",16,false));
        io.execute(()->{
            try{
                JSONObject payload=SupabaseClient.apiGet(token,"/api/mobile/soci-organi-societa");
                JSONArray clienti=payload.optJSONArray("data");
                if(clienti==null)clienti=new JSONArray();
                final JSONArray societa=clienti;
                runOnUiThread(()->{
                    renderSocietaOrgani(list,societa,"");
                    search.addTextChangedListener(new TextWatcher(){
                        public void beforeTextChanged(CharSequence x,int a,int bb,int c){}
                        public void onTextChanged(CharSequence x,int aa,int bb,int cc){renderSocietaOrgani(list,societa,x.toString());}
                        public void afterTextChanged(Editable e){}
                    });
                });
            }catch(Exception ex){runOnUiThread(()->{list.removeAllViews();list.addView(text("Errore: "+friendly(ex),14,false));});}
        });
    }

    private void renderSocietaOrgani(LinearLayout list,JSONArray clienti,String query){
        list.removeAllViews();String q=query.trim().toLowerCase(Locale.ITALY);int shown=0;
        for(int i=0;i<clienti.length();i++)try{
            JSONObject c=clienti.getJSONObject(i);String n=clean(c.optString("ragione_sociale"));String cod=clean(c.optString("cod_cliente"));
            if(!q.isEmpty()&&!(n+" "+cod+" "+clean(c.optString("codice_fiscale"))+" "+clean(c.optString("partita_iva"))).toLowerCase(Locale.ITALY).contains(q))continue;
            LinearLayout row=card();row.addView(text(n,18,true));if(!cod.isEmpty()){TextView m=text(cod,13,false);m.setTextColor(Color.GRAY);row.addView(m);}
            String id=c.optString("id");row.setOnClickListener(v->showOrganiSocieta(id,n));list.addView(row,cardLp());shown++;
        }catch(Exception ignore){}
        if(shown==0)list.addView(text("Nessuna società trovata.",16,false));
    }

    private void showOrganiSocieta(String clienteId,String societaNome){
        baseScreen("Soci e organi",true);((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showSociOrgani());
        content.addView(text(societaNome,23,true));content.addView(text("Caricamento soci e organi sociali…",15,false));
        io.execute(()->{
            try{
                JSONObject res=SupabaseClient.apiGet(token,"/api/clienti-organi?cliente_id="+SupabaseClient.eq(clienteId));
                JSONArray arr=res.optJSONArray("organi");if(arr==null)arr=new JSONArray();
                JSONObject teRes=SupabaseClient.apiGet(token,"/api/clienti/"+clienteId+"/titolari-effettivi");
                JSONArray te=teRes.optJSONArray("titolari_effettivi");if(te==null)te=new JSONArray();
                final JSONArray data=arr; final JSONArray titolari=te; final String criterio=clean(teRes.optString("criterio_utilizzato"));
                runOnUiThread(()->renderOrganiSocieta(societaNome,data,titolari,criterio));
            }catch(Exception ex){runOnUiThread(()->showError("Soci e organi sociali",ex));}
        });
    }

    private void renderOrganiSocieta(String societaNome,JSONArray arr,JSONArray titolari,String criterio){
        content.removeAllViews();content.addView(text(societaNome,23,true));
        content.addView(text("Titolare effettivo",20,true));
        if(titolari.length()==0){TextView e=text("Nessun titolare effettivo individuato.",14,false);e.setTextColor(Color.GRAY);content.addView(e);}
        else{
            for(int i=0;i<titolari.length();i++){JSONObject t=titolari.optJSONObject(i);if(t==null)continue;LinearLayout c=card();String nome=clean(t.optString("persona_nome"));c.addView(text(nome.isEmpty()?"Nominativo":nome,17,true));String cf=clean(t.optString("codice_fiscale"));if(!cf.isEmpty()){TextView x=text(cf,13,false);x.setTextColor(Color.GRAY);c.addView(x);}double q=t.optDouble("quota_complessiva",0);String tipo=clean(t.optString("tipo_titolarita"));String carica=clean(t.optString("carica"));String info="";if(q>0)info="Quota complessiva: "+String.format(Locale.ITALY,"%.2f",q)+"%";if(!tipo.isEmpty())info+=(info.isEmpty()?"":" · ")+tipo;if(!carica.isEmpty())info+=(info.isEmpty()?"":" · ")+carica;if(!info.isEmpty()){TextView z=text(info,14,false);z.setTextColor(blue);c.addView(z);}content.addView(c,cardLp());}
            if(!criterio.isEmpty()){TextView cr=text("Criterio: "+criterio,13,false);cr.setTextColor(Color.GRAY);content.addView(cr);}
        }
        renderOrganiSection("Soci",arr,"socio");
        renderOrganiSection("Organo di amministrazione",arr,"amministr");
        renderOrganiSection("Organo di controllo",arr,"controll");
    }

    private void renderOrganiSection(String title,JSONArray arr,String key){
        ArrayList<JSONObject> rows=new ArrayList<>();
        for(int i=0;i<arr.length();i++){JSONObject o=arr.optJSONObject(i);if(o==null||!o.optBoolean("attivo",true))continue;String ruolo=(clean(o.optString("ruolo"))+" "+clean(o.optString("tipo_ruolo"))+" "+clean(o.optString("carica"))).toLowerCase(Locale.ITALY);boolean match="socio".equals(key)?ruolo.contains("socio"):"amministr".equals(key)?(ruolo.contains("amministr")||ruolo.contains("presidente")||ruolo.contains("liquidator")||ruolo.contains("rappresentante")):(ruolo.contains("sindac")||ruolo.contains("revisor")||ruolo.contains("controll"));if(match)rows.add(o);}
        content.addView(text(title,20,true));
        if(rows.isEmpty()){TextView e=text("Nessun componente.",14,false);e.setTextColor(Color.GRAY);content.addView(e);return;}
        for(JSONObject o:rows){
            LinearLayout c=card();JSONObject sog=o.optJSONObject("soggetto_cliente");String nome=clean(o.optString("nominativo_nome"));if(nome.isEmpty()&&sog!=null)nome=clean(sog.optString("ragione_sociale"));c.addView(text(nome.isEmpty()?"Nominativo":nome,17,true));
            String ruolo=clean(o.optString("carica"));if(ruolo.isEmpty())ruolo=clean(o.optString("ruolo"));if(!ruolo.isEmpty()){TextView r=text(ruolo,14,true);r.setTextColor(blue);c.addView(r);}
            if("socio".equals(key)){double p=o.optDouble("percentuale_partecipazione",0);double nom=o.optDouble("importo_quota_nominale",0);String info=(p>0?("Partecipazione: "+p+"%"):"")+(nom>0?(p>0?" · ":"")+"Quota nominale: € "+String.format(Locale.ITALY,"%.2f",nom):"");if(!info.isEmpty())c.addView(text(info,14,false));}
            String dal=formatDateShort(clean(o.optString("data_nomina"))),al=formatDateShort(clean(o.optString("data_scadenza")));if(!dal.isEmpty()||!al.isEmpty())c.addView(text((dal.isEmpty()?"":"Dal "+dal)+(al.isEmpty()?"":" · al "+al),13,false));
            content.addView(c,cardLp());
        }
    }

    // GRUPPI SOCIETARI
    private void showGruppiSocietari(){
        baseScreen("Gruppi societari",true);
        EditText search=input("Cerca gruppo o capogruppo…");content.addView(search);
        LinearLayout holder=new LinearLayout(this);holder.setOrientation(LinearLayout.VERTICAL);content.addView(holder);
        holder.addView(text("Caricamento gruppi…",16,false));
        io.execute(()->{
            try{
                JSONObject res=SupabaseClient.apiGet(token,"/api/gruppi-societari");
                runOnUiThread(()->{
                    renderGruppi(res,"",holder);
                    search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence x,int a,int b,int c){}public void onTextChanged(CharSequence x,int a,int b,int c){renderGruppi(res,x.toString(),holder);}public void afterTextChanged(Editable e){}});
                });
            }
            catch(Exception ex){runOnUiThread(()->showError("Gruppi societari",ex));}
        });
    }

    private void renderGruppi(JSONObject res,String query,LinearLayout target){
        target.removeAllViews();String q=query.trim().toLowerCase(Locale.ITALY);
        JSONObject sum=res.optJSONObject("riepilogo");
        if(sum!=null&&q.isEmpty()){LinearLayout c=card();c.addView(text("Gruppi individuati: "+sum.optInt("gruppi_individuati"),17,true));c.addView(text("Partecipazioni: "+sum.optInt("totale_partecipazioni")+" · Società singole: "+sum.optInt("societa_singole"),14,false));target.addView(c,cardLp());}
        JSONArray groups=res.optJSONArray("gruppi_dettaglio");int count=0;
        if(groups!=null)for(int i=0;i<groups.length();i++)try{
            JSONObject g=groups.getJSONObject(i);JSONObject capo=g.optJSONObject("capogruppo");String titolo=capo==null?"Gruppo societario":clean(capo.optString("ragione_sociale"));if(titolo.isEmpty()&&capo!=null)titolo=clean(capo.optString("nome"));if(titolo.isEmpty())titolo="Gruppo societario";
            String denominazione=clean(g.optString("denominazione"));String hay=(titolo+" "+denominazione).toLowerCase(Locale.ITALY);if(!q.isEmpty()&&!hay.contains(q))continue;
            LinearLayout c=card();c.addView(text(titolo,19,true));JSONArray soc=g.optJSONArray("societa");if(soc!=null)c.addView(text(soc.length()+" società nel gruppo",14,false));
            if(soc!=null)for(int j=0;j<soc.length();j++){JSONObject x=soc.optJSONObject(j);if(x==null)continue;String n=clean(x.optString("nome"));if(n.isEmpty())n=clean(x.optString("ragione_sociale"));if(n.isEmpty())n=clean(x.optString("societa_nome"));if(!n.isEmpty()){TextView r=text("• "+n,14,true);r.setTextColor(Color.DKGRAY);c.addView(r);}JSONArray te=x.optJSONArray("titolari_effettivi");if(te!=null&&te.length()>0){for(int k=0;k<te.length();k++){JSONObject t=te.optJSONObject(k);if(t==null)continue;String pn=clean(t.optString("persona_nome"));double quota=t.optDouble("quota_complessiva",0);TextView tv=text("   Titolare effettivo: "+pn+(quota>0?" · "+String.format(Locale.ITALY,"%.2f",quota)+"%":""),13,false);tv.setTextColor(blue);c.addView(tv);}}}
            JSONArray teg=g.optJSONArray("titolari_effettivi_gruppo");if(teg!=null&&teg.length()>0){TextView head=text("Titolari effettivi del gruppo",14,true);head.setTextColor(navy);c.addView(head);for(int k=0;k<teg.length();k++){JSONObject t=teg.optJSONObject(k);if(t!=null)c.addView(text("• "+clean(t.optString("persona_nome")),14,false));}}
            target.addView(c,cardLp());count++;
        }catch(Exception ignore){}
        JSONArray single=res.optJSONArray("societa_singole");if(q.isEmpty()&&single!=null&&single.length()>0){target.addView(text("Società con partecipazioni fuori gruppo",20,true));for(int i=0;i<single.length();i++){JSONObject x=single.optJSONObject(i);if(x==null)continue;LinearLayout c=card();c.addView(text(clean(x.optString("ragione_sociale")),17,true));c.addView(text("Soci diretti: "+x.optInt("numero_soci_diretti")+" · Titolari effettivi: "+x.optInt("numero_titolari_effettivi"),13,false));target.addView(c,cardLp());}}
        if(count==0)target.addView(text("Nessun gruppo trovato.",16,false));
    }

    // PROMEMORIA
    private void showPromemoria(){
        baseScreen("Promemoria",true);Button add=button("+ Nuovo promemoria",true);content.addView(add);add.setOnClickListener(v->showNewPromemoria());
        LinearLayout list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);content.addView(list);list.addView(text("Caricamento promemoria…",16,false));
        io.execute(()->{
            try{
                JSONObject payload=SupabaseClient.apiGet(token,"/api/mobile/promemoria"); JSONArray arr=payload.optJSONArray("data"); if(arr==null)arr=new JSONArray(); final JSONArray data=arr;
                runOnUiThread(()->renderPromemoria(list,data));
            }catch(Exception ex){runOnUiThread(()->{list.removeAllViews();list.addView(text("Errore: "+friendly(ex),14,false));});}
        });
    }

    private void renderPromemoria(LinearLayout list,JSONArray arr){
        list.removeAllViews();int shown=0;String today=dayFmt.format(new Date());
        for(int i=0;i<arr.length();i++)try{
            JSONObject o=arr.getJSONObject(i);String stato=clean(o.optString("working_progress"));if("Completato".equalsIgnoreCase(stato)||"Annullata".equalsIgnoreCase(stato))continue;
            LinearLayout c=card();String code=clean(o.optString("codice_promemoria"));c.addView(text((code.isEmpty()?"":code+" · ")+clean(o.optString("titolo")),18,true));
            String due=clean(o.optString("data_scadenza"));TextView d=text("Scadenza: "+formatDateShort(due),14,false);d.setTextColor(!due.isEmpty()&&due.compareTo(today)<0?Color.RED:blue);c.addView(d);
            String pr=clean(o.optString("priorita")),st=clean(o.optString("working_progress"));c.addView(text((pr.isEmpty()?"":pr+" · ")+st,13,true));
            String desc=clean(o.optString("descrizione"));if(!desc.isEmpty()){TextView de=text(desc,14,false);de.setTextColor(Color.DKGRAY);c.addView(de);}
            list.addView(c,cardLp());shown++;
        }catch(Exception ignore){}
        if(shown==0)list.addView(text("Nessun promemoria disponibile.",16,false));
    }

    private void showNewPromemoria(){
        baseScreen("Nuovo promemoria",true);((Button)((LinearLayout)root.getChildAt(0)).getChildAt(0)).setOnClickListener(v->showPromemoria());
        EditText title=input("Titolo");EditText desc=input("Descrizione");EditText due=input("Data scadenza (AAAA-MM-GG)");due.setText(dayFmt.format(new Date()));
        Spinner priority=new Spinner(this);priority.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Normale","Alta","Urgente"}));
        Spinner sector=new Spinner(this);sector.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"","Fiscale","Consulenza","Lavoro"}));
        content.addView(title);content.addView(desc);content.addView(due);content.addView(text("Priorità",14,true));content.addView(priority);content.addView(text("Settore",14,true));content.addView(sector);
        Button save=button("Crea promemoria",true);content.addView(save);TextView status=text("",14,false);content.addView(status);
        save.setOnClickListener(v->{String t=title.getText().toString().trim(),date=due.getText().toString().trim();if(t.isEmpty()||!date.matches("\\d{4}-\\d{2}-\\d{2}")){status.setText("Titolo e data sono obbligatori.");return;}save.setEnabled(false);status.setText("Salvataggio…");
            io.execute(()->{try{
                JSONArray tipi=SupabaseClient.select(token,"tbtipopromemoria","select=id,nome&origine=eq.S&nome=ilike.Altro&limit=1");if(tipi.length()==0)throw new Exception("Tipo promemoria 'Altro' non configurato.");
                String tipoId=tipi.getJSONObject(0).optString("id");String today=dayFmt.format(new Date());int days=Math.max(0,(int)((dayFmt.parse(date).getTime()-dayFmt.parse(today).getTime())/(24L*60L*60L*1000L)));
                JSONObject b=new JSONObject().put("titolo",t).put("descrizione",emptyNull(desc.getText().toString())).put("data_inserimento",today).put("giorni_scadenza",days).put("data_scadenza",date).put("priorita",String.valueOf(priority.getSelectedItem())).put("working_progress","In lavorazione").put("operatore_id",userId).put("destinatario_id",userId).put("settore",emptyNull(String.valueOf(sector.getSelectedItem()))).put("tipo_promemoria_id",tipoId).put("studio_id",studioId);
                SupabaseClient.insert(token,"tbpromemoria",b);runOnUiThread(()->{Toast.makeText(this,"Promemoria creato",Toast.LENGTH_SHORT).show();showPromemoria();});
            }catch(Exception ex){runOnUiThread(()->{save.setEnabled(true);status.setText("Errore: "+friendly(ex));});}});
        });
    }

    private String formatDateShort(String d){
        if(d==null||d.length()<10)return clean(d);try{return d.substring(8,10)+"/"+d.substring(5,7)+"/"+d.substring(0,4);}catch(Exception e){return d;}
    }

    private String userLabel(String id){for(int i=0;i<agendaUsers.length();i++)try{JSONObject u=agendaUsers.getJSONObject(i);if(id.equals(u.optString("id")))return u.optString("cognome")+" "+u.optString("nome");}catch(Exception ignore){}return "";}
    private String userSector(String id){for(int i=0;i<agendaUsers.length();i++)try{JSONObject u=agendaUsers.getJSONObject(i);if(id.equals(u.optString("id")))return clean(u.optString("settore"));}catch(Exception ignore){}return "";}
    private Object emptyNull(String s){String x=s==null?"":s.trim();return x.isEmpty()?JSONObject.NULL:x;}
    private int parseIntSafe(String s,int d){try{return Integer.parseInt(s.trim());}catch(Exception e){return d;}}
    private String clean(String s){return s==null||"null".equalsIgnoreCase(s)?"":s.trim();}
    private String friendly(Exception ex){String m=ex.getMessage();if(m==null)return "Errore imprevisto";return m.length()>260?m.substring(0,260):m;}
    private void showComing(String title){baseScreen(title,true);content.addView(text(title,26,true));content.addView(text("Sezione prevista nella versione mobile nativa.",16,false));}
    private void showError(String area,Exception ex){content.removeAllViews();content.addView(text("Non riesco a caricare "+area+".",20,true));content.addView(text(friendly(ex),14,false));Button r=button("Riprova",true);content.addView(r);if("Agenda".equals(area))r.setOnClickListener(v->showAgenda());else r.setOnClickListener(v->showPresenze());}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+0.5f);}
}
