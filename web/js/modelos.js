import { ModeloVoxel } from './voxel.js'

export const PALETA = {
  pretoOlho: 0x1b1b24,
  brancoCamisa: 0xf3f1ea,
  calcaEscura: 0x2f3442,
  sapato: 0x3a2618,
  ternoMarinho: 0x26355e,
  gravataVermelha: 0xc8323c,
  sobretudoBege: 0xb8925a,
  chapeuMarrom: 0x5b3a22,
  faixaChapeu: 0x2a1a10,
  capaceteAmarelo: 0xf2c12e,
  capaceteSombra: 0xd9a514,
  plantaAzul: 0x3b6fd1,
  plantaClara: 0xdfe9fb,
  coleteLaranja: 0xf47c20,
  coleteFaixa: 0xe8e8e0,
  madeiraClara: 0xb07d48,
  madeiraEscura: 0x6e4a2c,
  madeiraTampo: 0xc28d55,
  metalCinza: 0x8e96a3,
  metalEscuro: 0x3c4250,
  telaMonitor: 0x5ad1e6,
  molduraMonitor: 0x22262f,
  teclado: 0xb9bec8,
  tecidoCadeira: 0x4a5d7a,
  lousaBranca: 0xf4f4f0,
  canetaAzul: 0x2f6fdf,
  canetaVermelha: 0xd94141,
  canetaVerde: 0x2e9e5a,
  rackEscuro: 0x1f2430,
  rackGaveta: 0x2d3446,
  ledVerde: 0x39ff88,
  ledAmbar: 0xffb02e,
  oceano: 0x2f7fd8,
  terra: 0x4caf50,
  vidroCeu: 0x9fd8f5,
  vidroCeuClaro: 0xc9ecfb,
  telefoneVermelho: 0xa8323a,
  vasoTerracota: 0xb5562f,
  folhaVerde: 0x3f9b4b,
  folhaClara: 0x62bf5e,
  papelEnvelope: 0xf7f3e8,
  dobraEnvelope: 0xd8d0bc,
  seloVermelho: 0xc0392b,
  seloVerde: 0x27ae60,
  papelAmassado: 0xbfbfb5,
  lupaAro: 0xc9a227,
  lupaVidro: 0xbfe6ff,
}

const CORES_ROUPA = [0x3f8efc, 0x2ec4b6, 0xe76f51, 0x9b5de5, 0xf4a261, 0x43aa8b, 0xef476f, 0x118ab2, 0x8ac926, 0xff924c]
const TONS_PELE = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]
const CORES_CABELO = [0x2b1d14, 0x4a3020, 0x8b5a2b, 0x1a1a1a, 0xd4a85a, 0x7a3b1d]

export function hashTexto(texto) {
  let hash = 2166136261
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function aparenciaDoAgente(agenteId, tipoAgente) {
  const hash = hashTexto(agenteId)
  const ehPrincipal = tipoAgente === 'principal'
  return {
    tipoAgente,
    corRoupa: ehPrincipal ? PALETA.ternoMarinho : CORES_ROUPA[hash % CORES_ROUPA.length],
    corPele: TONS_PELE[(hash >>> 4) % TONS_PELE.length],
    corCabelo: ehPrincipal ? 0x3b2a20 : CORES_CABELO[(hash >>> 8) % CORES_CABELO.length],
  }
}

export function modeloPerna(aparencia) {
  const corCalca = aparencia.tipoAgente === 'Explore' ? 0x4b3b2a : PALETA.calcaEscura
  return new ModeloVoxel(3, 6, 4).preencher(0, 2, 0, 2, 5, 3, corCalca).preencher(0, 0, 0, 2, 1, 3, PALETA.sapato)
}

export function modeloBraco(aparencia) {
  const corManga = aparencia.tipoAgente === 'Explore' ? PALETA.sobretudoBege : aparencia.corRoupa
  return new ModeloVoxel(2, 6, 3).preencher(0, 2, 0, 1, 5, 2, corManga).preencher(0, 0, 0, 1, 1, 2, aparencia.corPele)
}

export function modeloTronco(aparencia) {
  const tronco = new ModeloVoxel(8, 7, 5)
  const frente = 4
  switch (aparencia.tipoAgente) {
    case 'principal':
      tronco.preencher(0, 0, 0, 7, 6, 4, PALETA.ternoMarinho)
      tronco.preencher(2, 2, frente, 5, 6, frente, PALETA.brancoCamisa)
      tronco.preencher(3, 1, frente, 4, 5, frente, PALETA.gravataVermelha)
      tronco.pintar(3, 6, frente, PALETA.brancoCamisa).pintar(4, 6, frente, PALETA.brancoCamisa)
      break
    case 'Explore':
      tronco.preencher(0, 0, 0, 7, 6, 4, PALETA.sobretudoBege)
      tronco.preencher(3, 0, frente, 4, 6, frente, 0x9c7845)
      tronco.preencher(0, 1, 0, 7, 1, 4, 0x6b4f2a)
      tronco.pintar(2, 4, frente, 0x6b4f2a).pintar(5, 4, frente, 0x6b4f2a)
      break
    case 'Plan':
      tronco.preencher(0, 0, 0, 7, 6, 4, aparencia.corRoupa)
      tronco.preencher(0, 0, 0, 1, 5, 4, PALETA.coleteLaranja).preencher(6, 0, 0, 7, 5, 4, PALETA.coleteLaranja)
      tronco.preencher(0, 0, 0, 7, 5, 0, PALETA.coleteLaranja)
      tronco.preencher(0, 2, 0, 7, 2, 4, PALETA.coleteFaixa)
      break
    default:
      tronco.preencher(0, 0, 0, 7, 6, 4, aparencia.corRoupa)
      tronco.preencher(2, 6, frente, 5, 6, frente, PALETA.brancoCamisa)
      tronco.pintar(3, 5, frente, PALETA.brancoCamisa).pintar(4, 5, frente, PALETA.brancoCamisa)
      tronco.preencher(3, 0, frente, 4, 4, frente, mesclar(aparencia.corRoupa, 0xffffff, 0.25))
      tronco.preencher(0, 0, 0, 7, 0, 4, PALETA.calcaEscura)
  }
  return tronco
}

export function modeloCabeca(aparencia) {
  const cabeca = new ModeloVoxel(8, 7, 7)
  const frente = 6
  cabeca.preencher(0, 0, 0, 7, 6, 6, aparencia.corPele)
  cabeca.preencher(0, 5, 0, 7, 6, 6, aparencia.corCabelo)
  cabeca.preencher(0, 1, 0, 7, 4, 1, aparencia.corCabelo)
  cabeca.preencher(0, 3, 0, 0, 4, 4, aparencia.corCabelo).preencher(7, 3, 0, 7, 4, 4, aparencia.corCabelo)
  cabeca.pintar(2, 3, frente, PALETA.pretoOlho).pintar(5, 3, frente, PALETA.pretoOlho)
  cabeca.pintar(2, 2, frente, mesclar(aparencia.corPele, 0xff7f7f, 0.25)).pintar(5, 2, frente, mesclar(aparencia.corPele, 0xff7f7f, 0.25))
  cabeca.preencher(3, 1, frente, 4, 1, frente, mesclar(aparencia.corPele, 0x000000, 0.35))
  if (aparencia.tipoAgente === 'principal') cabeca.preencher(1, 6, 0, 6, 6, 5, mesclar(aparencia.corCabelo, 0xaaaaaa, 0.35))
  return cabeca
}

export function modeloChapeu(aparencia) {
  switch (aparencia.tipoAgente) {
    case 'Explore': {
      const chapeu = new ModeloVoxel(12, 4, 11)
      chapeu.preencher(0, 0, 0, 11, 0, 10, PALETA.chapeuMarrom)
      chapeu.preencher(2, 1, 2, 9, 3, 8, PALETA.chapeuMarrom)
      chapeu.preencher(2, 1, 2, 9, 1, 8, PALETA.faixaChapeu)
      chapeu.remover(5, 3, 3, 6, 3, 7)
      return chapeu
    }
    case 'Plan': {
      const capacete = new ModeloVoxel(10, 4, 10)
      capacete.preencher(1, 0, 1, 8, 2, 8, PALETA.capaceteAmarelo)
      capacete.preencher(2, 3, 2, 7, 3, 7, PALETA.capaceteAmarelo)
      capacete.preencher(1, 0, 9, 8, 0, 9, PALETA.capaceteSombra)
      capacete.preencher(4, 1, 1, 5, 3, 8, PALETA.capaceteSombra)
      return capacete
    }
    case 'principal':
    case 'general-purpose':
      return null
    default: {
      const bone = new ModeloVoxel(9, 3, 11)
      bone.preencher(0, 0, 0, 8, 2, 7, aparencia.corRoupa)
      bone.preencher(1, 0, 8, 7, 0, 10, mesclar(aparencia.corRoupa, 0x000000, 0.3))
      bone.pintar(4, 2, 3, PALETA.brancoCamisa)
      return bone
    }
  }
}

export function modeloObjetoNaMao(aparencia) {
  switch (aparencia.tipoAgente) {
    case 'Explore': {
      const lupa = new ModeloVoxel(5, 8, 1)
      lupa.preencher(2, 0, 0, 2, 3, 0, PALETA.madeiraEscura)
      lupa.preencher(0, 4, 0, 4, 7, 0, PALETA.lupaAro)
      lupa.preencher(1, 5, 0, 3, 6, 0, PALETA.lupaVidro)
      return lupa
    }
    case 'Plan': {
      const planta = new ModeloVoxel(2, 2, 8)
      planta.preencher(0, 0, 0, 1, 1, 7, PALETA.plantaAzul)
      planta.preencher(0, 0, 0, 1, 1, 0, PALETA.plantaClara).preencher(0, 0, 7, 1, 1, 7, PALETA.plantaClara)
      return planta
    }
    default:
      return null
  }
}

export function modeloEnvelope(tipoEntrega) {
  if (tipoEntrega === 'falha') {
    return new ModeloVoxel(4, 4, 4)
      .preencher(0, 1, 0, 3, 2, 3, PALETA.papelAmassado)
      .preencher(1, 0, 1, 2, 3, 2, PALETA.papelAmassado)
      .pintar(0, 1, 0, -1)
      .pintar(3, 2, 3, -1)
      .pintar(1, 3, 2, 0x9e9e94)
  }
  const envelope = new ModeloVoxel(7, 5, 1)
  envelope.preencher(0, 0, 0, 6, 4, 0, PALETA.papelEnvelope)
  envelope.pintar(0, 4, 0, PALETA.dobraEnvelope).pintar(1, 3, 0, PALETA.dobraEnvelope).pintar(2, 2, 0, PALETA.dobraEnvelope)
  envelope.pintar(6, 4, 0, PALETA.dobraEnvelope).pintar(5, 3, 0, PALETA.dobraEnvelope).pintar(4, 2, 0, PALETA.dobraEnvelope)
  envelope.pintar(3, 2, 0, tipoEntrega === 'resultado' ? PALETA.seloVerde : PALETA.seloVermelho)
  return envelope
}

export function modeloMesa() {
  const mesa = new ModeloVoxel(28, 20, 14)
  mesa.preencher(0, 10, 0, 27, 11, 13, PALETA.madeiraTampo)
  mesa.preencher(0, 10, 13, 27, 10, 13, PALETA.madeiraClara)
  for (const [x, z] of [[0, 0], [26, 0], [0, 12], [26, 12]]) mesa.preencher(x, 0, z, x + 1, 9, z + 1, PALETA.madeiraEscura)
  mesa.preencher(2, 3, 0, 25, 9, 0, PALETA.madeiraClara)
  mesa.preencher(9, 12, 2, 18, 12, 4, PALETA.metalEscuro)
  mesa.preencher(13, 13, 3, 14, 14, 3, PALETA.metalEscuro)
  mesa.preencher(7, 14, 2, 20, 19, 3, PALETA.molduraMonitor)
  mesa.preencher(8, 15, 3, 19, 18, 3, PALETA.telaMonitor)
  mesa.preencher(9, 17, 3, 14, 17, 3, 0xbff6ff).preencher(9, 16, 3, 16, 16, 3, 0x8fe6f5)
  mesa.preencher(9, 12, 8, 18, 12, 10, PALETA.teclado)
  mesa.preencher(21, 12, 8, 22, 12, 10, PALETA.metalCinza)
  mesa.preencher(2, 12, 3, 4, 14, 5, 0xe9e2d0).preencher(3, 14, 4, 3, 15, 4, 0x6e4a2c)
  return mesa
}

export function modeloCadeira() {
  const cadeira = new ModeloVoxel(10, 15, 10)
  cadeira.preencher(4, 0, 4, 5, 6, 5, PALETA.metalEscuro)
  cadeira.preencher(1, 0, 4, 8, 0, 5, PALETA.metalEscuro).preencher(4, 0, 1, 5, 0, 8, PALETA.metalEscuro)
  cadeira.preencher(0, 7, 0, 9, 8, 9, PALETA.tecidoCadeira)
  cadeira.preencher(0, 9, 8, 9, 14, 9, PALETA.tecidoCadeira)
  cadeira.preencher(1, 10, 9, 8, 13, 9, mesclar(PALETA.tecidoCadeira, 0xffffff, 0.15))
  return cadeira
}

export function modeloEstante() {
  const estante = new ModeloVoxel(30, 36, 9)
  estante.preencher(0, 0, 0, 29, 35, 8, PALETA.madeiraEscura)
  estante.remover(2, 2, 2, 27, 33, 8)
  const alturasPrateleira = [2, 10, 18, 26]
  const coresLivro = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x34495e, 0xe8e2d0]
  for (const base of alturasPrateleira) {
    estante.preencher(2, base - 1, 1, 27, base - 1, 8, PALETA.madeiraClara)
    let x = 3
    let indiceLivro = base
    while (x < 26) {
      const largura = 1 + (indiceLivro % 2)
      const altura = 4 + ((indiceLivro * 7) % 3)
      if ((indiceLivro * 5) % 11 !== 0) {
        estante.preencher(x, base, 3, Math.min(26, x + largura - 1), base + altura, 7, coresLivro[(indiceLivro * 3) % coresLivro.length])
      }
      x += largura + ((indiceLivro * 13) % 5 === 0 ? 1 : 0)
      indiceLivro++
    }
  }
  estante.preencher(2, 33, 1, 27, 33, 8, PALETA.madeiraClara)
  return estante
}

export function modeloLousa() {
  const lousa = new ModeloVoxel(32, 34, 6)
  lousa.preencher(1, 0, 1, 2, 12, 4, PALETA.metalCinza).preencher(29, 0, 1, 30, 12, 4, PALETA.metalCinza)
  lousa.preencher(0, 12, 2, 31, 33, 3, PALETA.metalCinza)
  lousa.preencher(1, 13, 3, 30, 32, 3, PALETA.lousaBranca)
  lousa.preencher(0, 12, 4, 31, 12, 5, PALETA.metalCinza)
  lousa.preencher(4, 29, 3, 18, 29, 3, PALETA.canetaAzul)
  lousa.preencher(4, 26, 3, 13, 26, 3, PALETA.canetaAzul).preencher(15, 26, 3, 22, 26, 3, PALETA.canetaAzul)
  lousa.preencher(4, 23, 3, 10, 23, 3, PALETA.canetaVerde)
  for (let i = 0; i < 7; i++) lousa.pintar(20 + i, 17 + Math.round(Math.abs(3 - i) * 0.8), 3, PALETA.canetaVermelha)
  lousa.preencher(5, 16, 3, 9, 20, 3, -1).preencher(5, 16, 3, 5, 20, 3, PALETA.canetaAzul).preencher(5, 16, 3, 9, 16, 3, PALETA.canetaAzul)
  lousa.preencher(9, 13, 4, 11, 13, 5, PALETA.canetaVermelha).preencher(14, 13, 4, 16, 13, 5, PALETA.canetaAzul)
  return lousa
}

export function modeloRack() {
  const rack = new ModeloVoxel(16, 36, 12)
  rack.preencher(0, 0, 0, 15, 35, 11, PALETA.rackEscuro)
  for (let y = 3; y < 33; y += 5) {
    rack.preencher(2, y, 11, 13, y + 3, 11, PALETA.rackGaveta)
    rack.preencher(3, y + 1, 11, 8, y + 1, 11, 0x3d4558)
  }
  return rack
}

export function modeloLedsRack() {
  const leds = new ModeloVoxel(16, 36, 1)
  for (let y = 3; y < 33; y += 5) {
    leds.pintar(11, y + 2, 0, PALETA.ledVerde)
    leds.pintar(12, y + 2, 0, (y % 10 === 3) ? PALETA.ledAmbar : PALETA.ledVerde)
  }
  return leds
}

export function modeloMesaGlobo() {
  const mesa = new ModeloVoxel(14, 26, 14)
  mesa.preencher(0, 9, 0, 13, 10, 13, PALETA.madeiraTampo)
  for (const [x, z] of [[1, 1], [11, 1], [1, 11], [11, 11]]) mesa.preencher(x, 0, z, x + 1, 8, z + 1, PALETA.madeiraEscura)
  mesa.preencher(5, 11, 5, 8, 11, 8, PALETA.lupaAro).preencher(6, 12, 6, 7, 13, 7, PALETA.lupaAro)
  const centro = [6.5, 19, 6.5]
  const raio = 5.6
  for (let z = 0; z < 14; z++)
    for (let y = 13; y < 26; y++)
      for (let x = 0; x < 14; x++) {
        const distancia = Math.hypot(x - centro[0], y - centro[1], z - centro[2])
        if (distancia > raio) continue
        const continente = Math.sin(x * 0.9 + y * 0.4) + Math.cos(z * 0.8 - y * 0.5) > 0.6
        mesa.pintar(x, y, z, continente ? PALETA.terra : PALETA.oceano)
      }
  return mesa
}

export function modeloJanela() {
  const janela = new ModeloVoxel(28, 22, 2)
  janela.preencher(0, 0, 0, 27, 21, 1, PALETA.madeiraClara)
  janela.preencher(2, 2, 1, 12, 19, 1, PALETA.vidroCeu).preencher(15, 2, 1, 25, 19, 1, PALETA.vidroCeu)
  for (let i = 0; i < 5; i++) janela.pintar(4 + i, 15 - i, 1, PALETA.vidroCeuClaro).pintar(17 + i, 15 - i, 1, PALETA.vidroCeuClaro)
  janela.preencher(4, 5, 1, 8, 6, 1, 0xffffff).preencher(18, 9, 1, 23, 10, 1, 0xffffff)
  return janela
}

export function modeloMesaTelefone() {
  const mesa = new ModeloVoxel(14, 15, 12)
  mesa.preencher(0, 9, 0, 13, 10, 11, PALETA.madeiraTampo)
  mesa.preencher(1, 0, 1, 12, 8, 10, PALETA.madeiraClara)
  mesa.preencher(2, 4, 10, 11, 4, 10, PALETA.madeiraEscura)
  mesa.preencher(3, 11, 3, 10, 12, 8, PALETA.telefoneVermelho)
  mesa.preencher(3, 13, 3, 10, 13, 4, PALETA.telefoneVermelho).preencher(3, 13, 7, 10, 13, 8, PALETA.telefoneVermelho)
  mesa.preencher(5, 13, 5, 8, 14, 6, 0x5e1b20)
  mesa.preencher(5, 12, 9, 8, 12, 9, 0xe8e2d0)
  return mesa
}

export function modeloVaso() {
  const vaso = new ModeloVoxel(10, 20, 10)
  vaso.preencher(2, 0, 2, 7, 6, 7, PALETA.vasoTerracota)
  vaso.preencher(1, 6, 1, 8, 7, 8, mesclar(PALETA.vasoTerracota, 0xffffff, 0.15))
  for (let y = 8; y < 20; y++)
    for (let z = 0; z < 10; z++)
      for (let x = 0; x < 10; x++) {
        const distancia = Math.hypot(x - 4.5, (y - 13) * 0.8, z - 4.5)
        if (distancia < 4.6 && ((x * 7 + y * 3 + z * 5) % 4 !== 0)) vaso.pintar(x, y, z, (x + y + z) % 3 === 0 ? PALETA.folhaClara : PALETA.folhaVerde)
      }
  return vaso
}

export function modeloBatentePorta() {
  const batente = new ModeloVoxel(4, 36, 20)
  batente.preencher(0, 0, 0, 3, 35, 1, PALETA.madeiraEscura)
  batente.preencher(0, 0, 18, 3, 35, 19, PALETA.madeiraEscura)
  batente.preencher(0, 33, 0, 3, 35, 19, PALETA.madeiraEscura)
  return batente
}

export function modeloFolhaPorta() {
  const folha = new ModeloVoxel(2, 32, 16)
  folha.preencher(0, 0, 0, 1, 31, 15, PALETA.madeiraClara)
  folha.preencher(0, 4, 2, 1, 13, 13, mesclar(PALETA.madeiraClara, 0x000000, 0.12))
  folha.preencher(0, 18, 2, 1, 28, 13, mesclar(PALETA.madeiraClara, 0x000000, 0.12))
  folha.preencher(0, 15, 12, 1, 16, 13, PALETA.lupaAro)
  return folha
}

export function mesclar(corA, corB, proporcaoB) {
  const canal = (cor, deslocamento) => (cor >> deslocamento) & 0xff
  const misturar = deslocamento => Math.round(canal(corA, deslocamento) * (1 - proporcaoB) + canal(corB, deslocamento) * proporcaoB)
  return (misturar(16) << 16) | (misturar(8) << 8) | misturar(0)
}
