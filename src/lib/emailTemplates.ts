export function getWelcomeEmailTemplate(
  nome: string,
  email: string,
  password: string,
  loginUrl: string = "https://studio-manager-pro.vercel.app/login"
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; font-size: 14px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .credentials h3 { margin-top: 0; color: #2563eb; }
    .credential-row { margin: 15px 0; }
    .label { font-weight: bold; color: #6b7280; display: block; margin-bottom: 5px; }
    .value { font-family: monospace; background: #f3f4f6; padding: 10px 15px; border-radius: 4px; display: block; font-size: 16px; color: #1f2937; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .button:hover { background: #1d4ed8; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .warning strong { color: #92400e; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏢 Studio Manager Pro</h1>
      <p>Benvenuto nel sistema</p>
    </div>
    
    <div class="content">
      <h2>Ciao ${nome}! 👋</h2>
      
      <p>Il tuo account è stato creato con successo.</p>
      
      <div class="credentials">
        <h3>🔐 Le tue credenziali di accesso:</h3>
        
        <div class="credential-row">
          <span class="label">📧 Email:</span>
          <span class="value">${email}</span>
        </div>
        
        <div class="credential-row">
          <span class="label">🔑 Password:</span>
          <span class="value">${password}</span>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">🚀 Accedi Ora</a>
      </div>
      
      <div class="warning">
        <strong>⚠️ Importante:</strong>
        <ul style="margin: 10px 0;">
          <li>Conserva questa email in un luogo sicuro</li>
          <li>Non condividere mai le tue credenziali</li>
        </ul>
      </div>
      
      <p>Se hai problemi ad accedere, contatta l'amministratore.</p>
      
      <p>Buon lavoro! 💼</p>
    </div>
    
    <div class="footer">
      <p><strong>Studio Manager Pro</strong> - Sistema Gestionale Integrato</p>
      <p>Questa è una email automatica, non rispondere a questo messaggio</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getPasswordResetEmailTemplate(
  nome: string,
  email: string,
  password: string,
  loginUrl: string = "https://studio-manager-pro.vercel.app/login"
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; font-size: 14px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
    .credentials h3 { margin-top: 0; color: #dc2626; }
    .credential-row { margin: 15px 0; }
    .label { font-weight: bold; color: #6b7280; display: block; margin-bottom: 5px; }
    .value { font-family: monospace; background: #f3f4f6; padding: 10px 15px; border-radius: 4px; display: block; font-size: 16px; color: #1f2937; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .button:hover { background: #b91c1c; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .warning strong { color: #92400e; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Password Reset</h1>
      <p>Studio Manager Pro</p>
    </div>
    
    <div class="content">
      <h2>Ciao ${nome},</h2>
      
      <p>La tua password è stata resettata dall'amministratore.</p>
      
      <div class="credentials">
        <h3>🔐 Le tue nuove credenziali:</h3>
        
        <div class="credential-row">
          <span class="label">📧 Email:</span>
          <span class="value">${email}</span>
        </div>
        
        <div class="credential-row">
          <span class="label">🔑 Nuova Password:</span>
          <span class="value">${password}</span>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">🚀 Accedi Ora</a>
      </div>
      
      <div class="warning">
        <strong>⚠️ Attenzione:</strong>
        <ul style="margin: 10px 0;">
          <li>La tua password precedente non è più valida</li>
          <li>Conserva questa email in un luogo sicuro</li>
        </ul>
      </div>
      
      <p>Se hai problemi ad accedere, contatta l'amministratore.</p>
      
      <p>Buon lavoro! 💼</p>
    </div>
    
    <div class="footer">
      <p><strong>Studio Manager Pro</strong> - Sistema Gestionale Integrato</p>
      <p>Questa è una email automatica, non rispondere a questo messaggio</p>
    </div>
  </div>
</body>
</html>
  `;
}