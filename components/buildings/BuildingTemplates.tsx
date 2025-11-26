"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  buildingId: string;
  initialSubject: string | null;
  initialBody: string | null;
  initialSmsBody: string | null;
}

const DEFAULT_SUBJECT = "vyúčtování #rok# | jednotka #jednotka_cislo# | #bytovy_dum#";
const DEFAULT_BODY = `#osloveni#,
zasíláme Vám v příloze vyúčtování k Vaší jednotce - #jednotka_cislo# v bytovém domě #bytovy_dum# za rok #rok#.

S pozdravem,
#spravce#

-------------
AdminReal s.r.o.
Veveří 2581/102, 616 00 Brno 
tel: +420 777 338 203 

info@adminreal.cz
www.adminreal.cz
www.onlinesprava.cz`;

const DEFAULT_SMS_BODY = `#osloveni# dnes Vám bylo na email #email# zasláno vyúčtování za rok #rok# k Vaší bytové jednotce #jednotka_cislo# v bytovém domě na adrese #bytovy_dum#. AdminReal s.r.o.`;

export function BuildingTemplates({ buildingId, initialSubject, initialBody, initialSmsBody }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject || DEFAULT_SUBJECT);
  const [body, setBody] = useState(initialBody || DEFAULT_BODY);
  const [smsBody, setSmsBody] = useState(initialSmsBody || DEFAULT_SMS_BODY);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/buildings/${buildingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          emailTemplateSubject: subject,
          emailTemplateBody: body,
          smsTemplateBody: smsBody
        }),
      });

      if (!response.ok) throw new Error('Chyba při ukládání');
      
      alert('Šablony byly uloženy');
      router.refresh();
    } catch (error) {
      console.error("Chyba ukládání:", error);
      alert("Ukládání selhalo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Opravdu chcete obnovit výchozí šablony?')) {
      setSubject(DEFAULT_SUBJECT);
      setBody(DEFAULT_BODY);
      setSmsBody(DEFAULT_SMS_BODY);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Šablony komunikace</h3>
        </div>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="subject" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Předmět emailu
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-medium transition-all placeholder-gray-400 dark:placeholder-gray-600"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Dostupné proměnné: <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#rok#</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#jednotka_cislo#</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#bytovy_dum#</code>
            </p>
          </div>

          <div>
            <label htmlFor="body" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Tělo emailu
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={15}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-mono text-sm transition-all placeholder-gray-400 dark:placeholder-gray-600"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Dostupné proměnné: 
              <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#osloveni#</code>, 
              <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#jednotka_cislo#</code>, 
              <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#bytovy_dum#</code>, 
              <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#rok#</code>, 
              <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">#spravce#</code>
            </p>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <label htmlFor="smsBody" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Text SMS
              </label>
            </div>
            <textarea
              id="smsBody"
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-green-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 rounded-xl text-gray-900 dark:text-white font-mono text-sm transition-all placeholder-gray-400 dark:placeholder-gray-600"
            />
            <div className="mt-2 flex justify-between items-start">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1 max-w-2xl">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Dostupné proměnné: 
                <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-green-600 dark:text-green-400">#osloveni#</code>, 
                <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-green-600 dark:text-green-400">#email#</code>, 
                <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-green-600 dark:text-green-400">#jednotka_cislo#</code>, 
                <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-green-600 dark:text-green-400">#bytovy_dum#</code>, 
                <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-green-600 dark:text-green-400">#rok#</code>, 
                <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-green-600 dark:text-green-400">#vysledek#</code>
              </p>
              <span className={`text-xs font-mono px-2 py-1 rounded ${smsBody.length > 160 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'}`}>
                {smsBody.length} znaků
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Obnovit výchozí
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Ukládám...
                </>
              ) : (
                <>
                  <span>Uložit šablony</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Nápověda k proměnným
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#osloveni#</span> <span>Automaticky doplní oslovení z evidence (např. &quot;Vážený pane Nováku&quot;)</span></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#jednotka_cislo#</span> <span>Číslo jednotky (např. &quot;318/01&quot;)</span></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#bytovy_dum#</span> <span>Název bytového domu</span></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#rok#</span> <span>Rok vyúčtování (např. &quot;2024&quot;)</span></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#spravce#</span> <span>Jméno správce (např. &quot;AdminReal s.r.o.&quot;)</span></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#email#</span> <span>Email vlastníka (pouze pro SMS)</span></li>
          <li className="flex items-start gap-2"><span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">#vysledek#</span> <span>Textový výsledek vyúčtování (např. &quot;přeplatek 123 Kč&quot;)</span></li>
        </ul>
      </div>
    </div>
  );
}
