/** Portado de segundo_cerebro@ffdf06435a5b8dcd047574172cddf1cc772dfd09. */
import { describe, expect, it } from "vitest";
import { dayRangeInTimeZone, FUSO_DO_APP, diaCivilDe, instanteDe, paraCampoLocal } from "../../src/core/tempo";

/**
 * Estes testes valem por rodarem em QUALQUER fuso de máquina — é o ponto
 * inteiro do módulo. Nenhum deles usa `new Date(string ingênua)` para montar a
 * expectativa, porque essa é justamente a função que estava errada: a
 * expectativa é sempre um instante absoluto escrito à mão.
 */
describe("instanteDe", () => {
  it("lê só-data como MEIA-NOITE no fuso do app, não como meia-noite UTC", () => {
    // O defeito original: `new Date("2026-08-07")` dava "2026-08-07T00:00:00Z",
    // que em São Paulo é 06/08 às 21h — o dia voltava um.
    expect(instanteDe("2026-08-07")).toBe("2026-08-07T03:00:00.000Z");
  });

  it("lê horário ingênuo no fuso do app, não no de quem executa", () => {
    expect(instanteDe("2026-08-07T14:00")).toBe("2026-08-07T17:00:00.000Z");
  });

  it("preserva o dia civil no ida-e-volta de uma data só", () => {
    for (const dia of ["2026-01-01", "2026-02-28", "2026-06-15", "2026-12-31"]) {
      expect(diaCivilDe(instanteDe(dia))).toBe(dia);
    }
  });

  it("não retrocede na virada de mês nem na de ano", () => {
    expect(diaCivilDe(instanteDe("2026-03-01"))).toBe("2026-03-01");
    expect(diaCivilDe(instanteDe("2027-01-01"))).toBe("2027-01-01");
  });

  it("aceita 29 de fevereiro em ano bissexto e recusa em ano comum", () => {
    expect(instanteDe("2028-02-29")).not.toBeNull();
    expect(instanteDe("2026-02-29")).toBeNull();
  });

  it("recusa dia que não existe no mês", () => {
    expect(instanteDe("2026-02-31")).toBeNull();
    expect(instanteDe("2026-04-31")).toBeNull();
    expect(instanteDe("2026-13-01")).toBeNull();
    expect(instanteDe("2026-00-10")).toBeNull();
  });

  it("recusa hora e minuto fora do relógio", () => {
    expect(instanteDe("2026-08-07T24:00")).toBeNull();
    expect(instanteDe("2026-08-07T10:60")).toBeNull();
  });

  it("recusa texto que não é data", () => {
    expect(instanteDe("x")).toBeNull();
    expect(instanteDe("")).toBeNull();
    expect(instanteDe("07/08/2026")).toBeNull();
  });

  it("aceita segundos opcionais", () => {
    expect(instanteDe("2026-08-07T14:00:30")).toBe("2026-08-07T17:00:30.000Z");
  });

  /**
   * O horário de verão foi abolido no Brasil em 2019, mas o app guarda datas
   * anteriores. Em 2018 São Paulo estava em UTC-2 no verão — se o módulo
   * travasse em -3, esta data voltaria uma hora errada.
   */
  it("respeita o horário de verão histórico", () => {
    expect(instanteDe("2018-01-15T12:00")).toBe("2018-01-15T14:00:00.000Z");
    expect(instanteDe("2018-07-15T12:00")).toBe("2018-07-15T15:00:00.000Z");
  });

  it("aceita fuso explícito para quem precisar sair do padrão", () => {
    expect(instanteDe("2026-08-07T00:00", "UTC")).toBe("2026-08-07T00:00:00.000Z");
    expect(instanteDe("2026-08-07T00:00", "Asia/Tokyo")).toBe("2026-08-06T15:00:00.000Z");
  });
});

describe("paraCampoLocal", () => {
  it("devolve 10 caracteres para type=date e 16 para datetime-local", () => {
    const iso = "2026-08-07T17:00:00.000Z";
    expect(paraCampoLocal(iso, "date")).toBe("2026-08-07");
    expect(paraCampoLocal(iso, "datetime")).toBe("2026-08-07T14:00");
  });

  /**
   * O defeito que o parâmetro `formato` existe para impedir: a versão anterior
   * devolvia sempre 16 caracteres, e um `<input type="date">` recebendo
   * "2026-08-07T14:00" DESCARTA o valor — o campo aparecia vazio mesmo havendo
   * data salva.
   */
  it("o valor de type=date casa com o formato que o input aceita", () => {
    expect(paraCampoLocal("2026-08-07T17:00:00.000Z", "date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("devolve string vazia para nulo, indefinido e data inválida", () => {
    expect(paraCampoLocal(null, "date")).toBe("");
    expect(paraCampoLocal(undefined, "datetime")).toBe("");
    expect(paraCampoLocal("nada disso", "datetime")).toBe("");
  });

  it("mostra a meia-noite de São Paulo como 00:00, não como 21:00 do dia anterior", () => {
    const meiaNoite = instanteDe("2026-08-07")!;
    expect(paraCampoLocal(meiaNoite, "datetime")).toBe("2026-08-07T00:00");
  });

  it("fecha o ciclo: campo → instante → campo devolve o mesmo texto", () => {
    for (const valor of ["2026-08-07T14:00", "2026-01-01T00:00", "2026-12-31T23:59"]) {
      expect(paraCampoLocal(instanteDe(valor), "datetime")).toBe(valor);
    }
  });
});

describe("FUSO_DO_APP", () => {
  it("é o mesmo fuso em que a interface formata", () => {
    expect(FUSO_DO_APP).toBe("America/Sao_Paulo");
  });
});

describe("dayRangeInTimeZone", () => {
  const SP = "America/Sao_Paulo";

  it("recorta o dia civil de São Paulo, não o dia UTC", () => {
    // 2 de agosto de 2026, 15h em São Paulo (18h UTC).
    const r = dayRangeInTimeZone(new Date("2026-08-02T18:00:00.000Z"), SP);
    expect(r.dayKey).toBe("2026-08-02");
    expect(r.startIso).toBe("2026-08-02T03:00:00.000Z"); // meia-noite -03:00
    expect(r.endIso).toBe("2026-08-03T03:00:00.000Z"); // exclusivo
  });

  it("às 22h de São Paulo o dia ainda é hoje — o caso que quebrava no servidor", () => {
    // 22h de 2/8 em SP = 01h UTC de 3/8. Num processo rodando em UTC — que é o
    // caso da Vercel — `startOfDay` diria que "hoje" é 3 de agosto, e das 21h à
    // meia-noite a agenda mostraria os eventos de amanhã.
    const instante = new Date("2026-08-03T01:00:00.000Z");
    expect(dayRangeInTimeZone(instante, SP).dayKey).toBe("2026-08-02");

    // `startOfDay` depende do fuso do processo; a função nova, não. Só dá para
    // afirmar a divergência quando o processo de teste realmente está em UTC.
    if (new Date().getTimezoneOffset() === 0) {
      const antigoInicioLocal = new Date(instante);
      antigoInicioLocal.setHours(0, 0, 0, 0);
      expect(antigoInicioLocal.toISOString().slice(0, 10)).toBe("2026-08-03");
    }
  });

  it("a chave do dia NÃO é o recorte do fim do intervalo", () => {
    // A armadilha que motiva o campo `dayKey`: o `endIso` de um dia de São Paulo
    // cai sempre na data seguinte quando lido como texto.
    const r = dayRangeInTimeZone(new Date("2026-08-02T18:00:00.000Z"), SP);
    expect(r.endIso.slice(0, 10)).toBe("2026-08-03");
    expect(r.dayKey).toBe("2026-08-02");
  });

  it("vira o mês e o ano corretamente", () => {
    const fimDoMes = dayRangeInTimeZone(new Date("2026-08-31T20:00:00.000Z"), SP);
    expect(fimDoMes.dayKey).toBe("2026-08-31");
    expect(fimDoMes.endIso).toBe("2026-09-01T03:00:00.000Z");

    // 31/12 às 22h em SP = 01h UTC de 1º de janeiro.
    const reveillon = dayRangeInTimeZone(new Date("2027-01-01T01:00:00.000Z"), SP);
    expect(reveillon.dayKey).toBe("2026-12-31");
    expect(reveillon.endIso).toBe("2027-01-01T03:00:00.000Z");
  });

  it("o intervalo tem exatamente 24 h e o fim é exclusivo", () => {
    const r = dayRangeInTimeZone(new Date("2026-08-02T18:00:00.000Z"), SP);
    const duracao = new Date(r.endIso).getTime() - new Date(r.startIso).getTime();
    expect(duracao).toBe(24 * 60 * 60 * 1000);
    // Meia-noite do dia seguinte pertence ao dia seguinte, não a este.
    expect(dayRangeInTimeZone(new Date(r.endIso), SP).dayKey).toBe("2026-08-03");
  });

  it("funciona em fuso com horário de verão (a segunda passada do cálculo)", () => {
    // 8 de março de 2026, virada do DST nos EUA: 2h vira 3h em Nova York.
    // A meia-noite desse dia ainda é -05:00; o dia dura 23 h.
    const r = dayRangeInTimeZone(new Date("2026-03-08T18:00:00.000Z"), "America/New_York");
    expect(r.dayKey).toBe("2026-03-08");
    expect(r.startIso).toBe("2026-03-08T05:00:00.000Z");
    expect(r.endIso).toBe("2026-03-09T04:00:00.000Z");
    const duracao = new Date(r.endIso).getTime() - new Date(r.startIso).getTime();
    expect(duracao).toBe(23 * 60 * 60 * 1000);
  });
});

describe("transições civis e anos ISO inferiores a 100", () => {
  it("data civil começa no primeiro instante válido quando São Paulo pula a meia-noite", () => {
    expect(instanteDe("2018-11-04")).toBe("2018-11-04T03:00:00.000Z");
    expect(paraCampoLocal(instanteDe("2018-11-04"), "datetime")).toBe("2018-11-04T01:00");
  });

  it("horário inexistente avança pela duração do salto, preservando os minutos", () => {
    expect(instanteDe("2018-11-04T00:30")).toBe("2018-11-04T03:30:00.000Z");
    expect(paraCampoLocal(instanteDe("2018-11-04T00:30"), "datetime")).toBe("2018-11-04T01:30");
    expect(instanteDe("2026-03-08T02:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
  });

  it("horário repetido escolhe a ocorrência anterior", () => {
    expect(instanteDe("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
    expect(instanteDe("2019-02-16T23:30")).toBe("2019-02-17T01:30:00.000Z");
  });

  it("não pressupõe que o salto tem uma hora", () => {
    expect(instanteDe("2026-10-04T02:15", "Australia/Lord_Howe")).toBe("2026-10-03T15:45:00.000Z");
  });

  it("mantém faixas contíguas e inclui todos os instantes na virada histórica de São Paulo", () => {
    const anterior = dayRangeInTimeZone(new Date("2018-11-03T15:00:00Z"));
    const transicao = dayRangeInTimeZone(new Date("2018-11-04T15:00:00Z"));
    const seguinte = dayRangeInTimeZone(new Date("2018-11-05T15:00:00Z"));
    expect(anterior.endIso).toBe("2018-11-04T03:00:00.000Z");
    expect(anterior.endIso).toBe(transicao.startIso);
    expect(transicao.endIso).toBe(seguinte.startIso);
    expect(Date.parse(transicao.endIso) - Date.parse(transicao.startIso)).toBe(23 * 3_600_000);
    expect(dayRangeInTimeZone(new Date("2018-11-04T02:30:00Z")).dayKey).toBe("2018-11-03");
  });

  it("o fim do dia inclui ambas as ocorrências da hora repetida", () => {
    const transicao = dayRangeInTimeZone(new Date("2019-02-16T15:00:00Z"));
    const seguinte = dayRangeInTimeZone(new Date("2019-02-17T15:00:00Z"));
    expect(transicao.endIso).toBe(seguinte.startIso);
    expect(Date.parse(transicao.endIso) - Date.parse(transicao.startIso)).toBe(25 * 3_600_000);
    expect(dayRangeInTimeZone(new Date("2019-02-17T02:30:00Z")).dayKey).toBe("2019-02-16");
  });

  it("uma data inteira pulada pelo fuso não abre uma lacuna entre os dias existentes", () => {
    const fuso = "Pacific/Apia";
    const anterior = dayRangeInTimeZone(new Date("2011-12-29T22:00:00Z"), fuso);
    const seguinte = dayRangeInTimeZone(new Date("2011-12-30T22:00:00Z"), fuso);
    expect(anterior.dayKey).toBe("2011-12-29");
    expect(seguinte.dayKey).toBe("2011-12-31");
    expect(anterior.endIso).toBe("2011-12-30T10:00:00.000Z");
    expect(anterior.endIso).toBe(seguinte.startIso);
    expect(instanteDe("2011-12-30", fuso)).toBe(seguinte.startIso);
  });

  it("preserva anos 0001 e 0099 na conversão e na formatação", () => {
    for (const data of ["0001-01-01", "0099-12-31"]) {
      expect(instanteDe(data, "UTC")).toBe(`${data}T00:00:00.000Z`);
      expect(diaCivilDe(instanteDe(data))).toBe(data);
      expect(paraCampoLocal(instanteDe(`${data}T12:30`, "UTC"), "datetime", "UTC")).toBe(`${data}T12:30`);
    }
  });

  it("a faixa de dia antigo cruza o ano 0099 sem saltar para 1999", () => {
    expect(dayRangeInTimeZone(new Date("0099-12-31T12:00:00Z"), "UTC")).toEqual({
      dayKey: "0099-12-31", startIso: "0099-12-31T00:00:00.000Z", endIso: "0100-01-01T00:00:00.000Z",
    });
  });
});
