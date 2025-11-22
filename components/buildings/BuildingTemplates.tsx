"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  buildingId: string;
  initialSubject: string | null;
  initialBody: string | null;
  initialSmsBody: string | null;
}

const DEFAULT_SUBJECT = "vyúčtování #rok# | #jednotka_cislo# | #bytovy_dum#";
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
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium mb-4">Šablona emailu pro vyúčtování</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Předmět emailu
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Dostupné proměnné: #rok#, #jednotka_cislo#, #bytovy_dum#
            </p>
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Tělo emailu
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Dostupné proměnné: #osloveni#, #jednotka_cislo#, #bytovy_dum#, #rok#, #spravce#
            </p>
          </div>

          <div>
            <label htmlFor="smsBody" className="block text-sm font-medium text-gray-700 mb-1">
              Text SMS
            </label>
            <textarea
              id="smsBody"
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Dostupné proměnné: #osloveni#, #email#, #jednotka_cislo#, #bytovy_dum#, #rok#, #vysledek#
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Pozor: Délka jedné SMS je 160 znaků. Delší text bude rozdělen do více zpráv.
            </p>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Obnovit výchozí
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
            >
              {isSaving ? 'Ukládám...' : 'Uložit šablonu'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Nápověda k proměnným</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li><strong>#osloveni#</strong> - Automaticky doplní oslovení z evidence (např. &quot;Vážený pane Nováku&quot;)</li>
          <li><strong>#jednotka_cislo#</strong> - Číslo jednotky (např. &quot;318/01&quot;)</li>
          <li><strong>#bytovy_dum#</strong> - Název bytového domu</li>
          <li><strong>#rok#</strong> - Rok vyúčtování (např. &quot;2024&quot;)</li>
          <li><strong>#spravce#</strong> - Jméno správce (např. &quot;AdminReal s.r.o.&quot;)</li>
          <li><strong>#email#</strong> - Email vlastníka (pouze pro SMS)</li>
          <li><strong>#vysledek#</strong> - Textový výsledek vyúčtování (např. &quot;přeplatek 123 Kč&quot;)</li>
        </ul>
      </div>
    </div>
  );
}
