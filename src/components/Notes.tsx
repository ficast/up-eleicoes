export function Notes() {
  return (
    <section className="bg-[var(--band)] mt-16">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-3">
        <h2 className="font-display font-extrabold uppercase text-3xl">Como ler estes dados</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Fonte: votação por seção eleitoral do TSE (1º turno), conferida com os totais oficiais por partido.</li>
          <li><b>Votos</b>: em Presidente, Governador, Senador e Prefeito contam os votos nos candidatos da UP. Para deputados e vereadores, somam-se os votos nominais e os de legenda (80).</li>
          <li><b>Candidaturas na Justiça</b>: votos em candidaturas <i>sub judice</i> (ainda em julgamento na eleição) contam. Votos anulados (candidatura indeferida, cancelada ou chapa anulada) não contam, como na totalização oficial do TSE.</li>
          <li><b>% válidos</b>: votos da UP ÷ votos válidos (sem brancos e nulos) no mesmo lugar e cargo, só onde a UP disputou.</li>
          <li><b>Comparações do mesmo cargo</b> (2022 × 2026, 2020 × 2024) mostram votos, %, municípios e locais de votação. O TSE renumera seções entre eleições, então a comparação fina é feita por <b>local de votação</b> (casado pelo número do local ou pelo nome da escola). Locais sem par na outra eleição aparecem como novos ou sem par, sem variação. As seções aparecem no detalhe de cada local.</li>
          <li><b>Comparações entre cargos ou tipos de eleição diferentes</b> (ex.: Vereador 2024 × Dep. Federal 2026) mostram só o número de votos, por estado e município.</li>
          <li>Cada eleitor vota em vários cargos. Por isso a Linha do tempo nunca soma cargos: cada barra é um cargo.</li>
          <li>Em “Tudo”, o exterior aparece no mapa do Brasil como uma área extra (Exterior), só para Presidente.</li>
          <li>No exterior só há votação para Presidente. Locais sem coordenadas aparecem no centro do município (“localização aproximada”).</li>
          <li>Onde a UP não lançou candidatura, o site mostra “—” (sem candidatura), que é diferente de zero votos.</li>
        </ul>
      </div>
    </section>
  );
}
