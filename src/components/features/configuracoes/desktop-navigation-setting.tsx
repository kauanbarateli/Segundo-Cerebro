"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  currentDesktopNavigation, DESKTOP_DOCK_QUERY, saveDesktopNavigation, subscribeDesktopNavigation, type DesktopNavigationMode,
} from "@/lib/navigation/desktop-navigation-preference";
import "./desktop-navigation-setting.css";

const OPTIONS: readonly { value: DesktopNavigationMode; title: string; description: string; standard: boolean }[] = [
  { value: "sidebar", title: "Menu lateral", description: "Módulos organizados à esquerda.", standard: true },
  { value: "dock", title: "Dock inferior", description: "Ícones na parte inferior. Passe o mouse ou use o teclado para ver os nomes.", standard: false },
];

function useEligibleDesktop() {
  return useSyncExternalStore(
    (onChange) => { const media = window.matchMedia(DESKTOP_DOCK_QUERY); media.addEventListener("change", onChange); return () => media.removeEventListener("change", onChange); },
    () => window.matchMedia(DESKTOP_DOCK_QUERY).matches,
    () => false,
  );
}

/**
 * Configurações → Aparência → Navegação no computador (doc21). Browser-local
 * presentation only: never posts `settings.preferences.update`, never touches the
 * theme or other drafts on the page. Radios edit a local draft; "Aplicar navegação"
 * is the single write. Another tab's change follows the applied value unless this
 * tab has an unapplied selection, which is kept with a notice.
 */
export function DesktopNavigationSetting() {
  const applied = useSyncExternalStore(subscribeDesktopNavigation, currentDesktopNavigation, () => "sidebar" as const);
  const eligible = useEligibleDesktop();
  const name = useId();
  const [draft, setDraft] = useState<DesktopNavigationMode | null>(null);
  const [status, setStatus] = useState("");
  const previous = useRef(applied);
  const value = draft ?? applied;
  const dirty = draft !== null && draft !== applied;

  useEffect(() => {
    if (previous.current === applied) return;
    previous.current = applied;
    if (draft === null || draft === applied) { setDraft(null); setStatus(""); return; }
    setStatus("A navegação mudou em outra aba. Sua seleção continua aqui até você aplicar.");
  }, [applied, draft]);

  const choose = (mode: DesktopNavigationMode) => { setDraft(mode); setStatus(""); };
  const apply = () => {
    if (!dirty) return;
    const { persisted } = saveDesktopNavigation(value);
    previous.current = value;
    setDraft(null);
    setStatus(persisted ? "Navegação atualizada neste navegador." : "Aplicado nesta visita. O navegador não permitiu salvar a preferência.");
  };

  return (
    <fieldset id="navegacao-no-computador" className="desktop-navigation">
      <legend className="desktop-navigation__legend">Navegação no computador</legend>
      <p className="desktop-navigation__hint">Escolha como acessar suas áreas. Esta preferência fica salva somente neste navegador.</p>
      {eligible ? <>
        <div className="desktop-navigation__options">
          {OPTIONS.map((option) => (
            <label key={option.value} className="desktop-navigation__option" data-selected={value === option.value || undefined}>
              {/* eslint-disable-next-line no-restricted-syntax -- a radio card is not a text Field. */}
              <input type="radio" className="desktop-navigation__input" name={name} value={option.value} checked={value === option.value} onChange={() => choose(option.value)} />
              <span className={`desktop-navigation__preview desktop-navigation__preview--${option.value}`} aria-hidden="true">
                <span className="desktop-navigation__window">
                  {option.value === "sidebar" && <span className="desktop-navigation__rail"><i /><i /><i /><i /></span>}
                  <span className="desktop-navigation__content"><i /><i /><i /></span>
                  {option.value === "dock" && <span className="desktop-navigation__dock"><i /><i /><i /><i /><i /></span>}
                </span>
              </span>
              <span className="desktop-navigation__copy">
                <span className="desktop-navigation__title">
                  <span className="desktop-navigation__radio" aria-hidden="true" />
                  {option.title}
                  {option.standard && <span className="desktop-navigation__badge">Padrão</span>}
                </span>
                <span className="desktop-navigation__description">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="desktop-navigation__actions">
          {/* aria-disabled keeps focus on the trigger after applying (disabled would drop it). */}
          <Button variant="secondary" className="desktop-navigation__apply" aria-disabled={!dirty} onClick={apply}>Aplicar navegação</Button>
          {/* Always mounted so assistive tech announces each new message. */}
          <p className="desktop-navigation__status" role="status">{status}</p>
        </div>
      </> : <p className="desktop-navigation__hint">A navegação por dock está disponível no computador. Neste dispositivo, o menu atual é mantido.</p>}
    </fieldset>
  );
}
