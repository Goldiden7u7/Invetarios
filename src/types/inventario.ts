/**
 * TIPOS DEL DOMINIO
 * -----------------------------------------------------------------
 * Reflejan lo que devuelve la API PHP. Si cambias una consulta en el .php,
 * cambias el tipo aqui en el mismo commit.
 */

// ----------------------------------------------------------------------
//  Permisos
// ----------------------------------------------------------------------

/**
 * Los permisos son banderas de bits, no una lista. El backend los guarda en
 * una sola columna `permisos` de la tabla `roles`:
 *
 *   ver=1, crear=2, editar=4, eliminar=8, movimientos=16, usuarios=32, config=64
 */
export const PERMISO = {
  ver: 1,
  crear: 2,
  editar: 4,
  eliminar: 8,
  movimientos: 16,
  usuarios: 32,
  config: 64,
  /**
   * Los tres bits de arriba dicen QUE puedes hacer (crear, editar...).
   * Estos tres dicen DONDE: en que modulos de la app te dejan entrar.
   *
   * Son los que separan los distintos trabajos del dia a dia, para que el
   * que cobra no vea las ventas y el de cocina no pueda cobrar:
   *
   *   ventas  -> ver el Resumen (dashboard) con las cifras y el historial
   *   caja    -> abrir la Caja y registrar ventas
   *   cocina  -> abrir la pantalla de Cocina y mover pedidos
   */
  ventas: 128,
  caja: 256,
  cocina: 512,
} as const;

/** Comprueba si el usuario tiene TODOS los bits indicados. */
export function tienePermiso(permisos: number, ...bits: number[]) {
  // eslint-disable-next-line no-bitwise -- los permisos SON banderas de bits
  return bits.every((bit) => (permisos & bit) === bit);
}

// ----------------------------------------------------------------------
//  Usuario
// ----------------------------------------------------------------------

export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  permisos: number;
  telefono?: string | null;
};

export type RespuestaLogin = Usuario;

// ----------------------------------------------------------------------
//  Producto
// ----------------------------------------------------------------------

/** Estado de stock que calcula el API. */
export type EstadoStock = 'normal' | 'bajo' | 'agotado';

export type Producto = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: number | null;
  categoria: string | null;
  unidad_medida: string;
  precio_compra: number;
  precio_venta: number;
  stock_minimo: number;
  stock_maximo: number;
  controla_serial: number;
  perecedero: number;
  fecha_vencimiento: string | null;
  /** Dias que faltan para vencer (negativo = ya vencio). Solo en el listado. */
  dias_para_vencer: number | null;
  activo: number;
  creado_en: string;
  // Solo en el listado (los agrega el JOIN con la vista de totales):
  cantidad_total: number;
  almacenes_con_stock: number;
  estado_stock: EstadoStock;
};

export type Paginacion = {
  pagina: number;
  por_pagina: number;
  total: number;
  total_paginas: number;
};

export type RespuestaProductos = {
  productos: Producto[];
  paginacion: Paginacion;
};

/** Detalle de un producto: suma el stock desglosado por almacen. */
export type DetalleProducto = Producto & {
  stock_por_almacen: StockAlmacen[];
  seriales?: NumeroSerie[];
};

export type StockAlmacen = {
  almacen_id: number;
  almacen_codigo: string;
  almacen_nombre: string;
  cantidad: number;
  ultima_entrada: string | null;
  ultima_salida: string | null;
};

export type NumeroSerie = {
  id: number;
  serial: string;
  estado: string;
  almacen_id: number | null;
  observacion: string | null;
};

// ----------------------------------------------------------------------
//  Almacen y categoria
// ----------------------------------------------------------------------

export type Almacen = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  responsable: string | null;
  activo: number;
  productos?: number;
  unidades?: number;
  alertas?: number;
  valor_costo?: number;
  valor_venta?: number;
};

export type Categoria = {
  id: number;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  activo: number;
  productos?: number;
  unidades?: number;
};

// ----------------------------------------------------------------------
//  Movimientos
// ----------------------------------------------------------------------

/** El API guarda la cantidad con signo: las salidas son negativas. */
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'transferencia';

export type Movimiento = {
  id: number;
  tipo: TipoMovimiento;
  producto_id: number;
  almacen_id: number;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  costo_unitario: number;
  referencia: string | null;
  notas: string | null;
  creado_en: string;
  // Campos que agrega el JOIN de la lista:
  producto_nombre?: string;
  producto_codigo?: string;
  almacen_nombre?: string;
  almacen_codigo?: string;
  usuario_nombre?: string;
  usuario_id?: number;
  unidad_medida?: string;
};

// ----------------------------------------------------------------------
//  Transferencias
// ----------------------------------------------------------------------

export type EstadoTransferencia = 'en_transito' | 'recibida' | 'cancelada';

export type Transferencia = {
  id: number;
  codigo: string;
  producto_id: number;
  almacen_origen_id: number;
  almacen_destino_id: number;
  cantidad: number;
  estado: EstadoTransferencia;
  notas: string | null;
  enviado_por: number | null;
  recibido_por: number | null;
  fecha_envio: string;
  fecha_recepcion: string | null;
  producto_nombre?: string;
  producto_codigo?: string;
  origen_nombre?: string;
  destino_nombre?: string;
  enviado_nombre?: string;
  recibido_nombre?: string;
};

// ----------------------------------------------------------------------
//  Dashboard
// ----------------------------------------------------------------------

export type ResumenPeriodo = {
  entradas: number;
  salidas: number;
  total: number;
};

export type ResumenVentas = {
  ventas: number;
  total: number;
  ganancia: number;
};

export type Metricas = {
  productos_activos: number;
  almacenes_activos: number;
  unidades_totales: number;
  valor_costo: number;
  valor_venta: number;
  utilidad_potencial: number;
  margen_porcentaje: number;
  alertas_stock: number;
  agotados: number;
  usuarios_activos: number;
  mes: ResumenPeriodo;
  hoy: ResumenPeriodo;
  // ---------------------------------------------------------------
  //  Analisis de ventas (agregado para la cafeteria / POS)
  // ---------------------------------------------------------------
  ventas_hoy: ResumenVentas;
  ventas_mes: ResumenVentas;
  /** Ganancias reales acumuladas (total vendido - costo de lo vendido). */
  ganancia_real: number;
  /** Total acumulado de ventas completadas. */
  ventas_totales: number;
  /** Margen real sobre lo vendido (%). */
  margen_venta_real: number;
  /** Pedidos de cocina pendientes + en preparacion + listos. */
  pedidos_pendientes: number;
  /** Productos perecederos que vencen dentro de 7 dias. */
  proximos_vencer: number;
};

export type MovimientoDiario = {
  fecha: string;
  entradas: number;
  salidas: number;
};

export type StockPorAlmacen = {
  nombre: string;
  codigo: string;
  unidades: number;
  valor: number;
};

export type UnidadesPorCategoria = {
  categoria: string;
  unidades: number;
};

export type TopMovimiento = {
  nombre: string;
  codigo: string;
  entradas: number;
  salidas: number;
};

/** Serie de ventas por dia (30 dias, con ceros en los dias sin ventas). */
export type VentaDiaria = {
  fecha: string;
  ventas: number;
  total: number;
};

/** Serie de ventas por semana (8 semanas, agrupadas desde el lunes). */
export type VentaSemanal = {
  semana: string;
  ventas: number;
  total: number;
};

export type TopCombo = {
  id: number;
  nombre: string;
  tipo: TipoCombo;
  unidades: number;
  venta_total: number;
};

export type TopProducto = {
  producto_id: number;
  nombre: string;
  cantidad: number;
};

export type Graficas = {
  movimientos_diarios: MovimientoDiario[];
  stock_por_almacen: StockPorAlmacen[];
  por_categoria: UnidadesPorCategoria[];
  top_movimientos: TopMovimiento[];
  // ---------------------------------------------------------------
  //  Analisis de ventas
  // ---------------------------------------------------------------
  ventas_diarias: VentaDiaria[];
  ventas_semanales: VentaSemanal[];
  top_combos: TopCombo[];
  top_productos: TopProducto[];
};

/** Fila de la vista v_alertas_stock. */
export type AlertaStock = {
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  unidad_medida: string;
  almacen_id: number;
  almacen_codigo: string;
  almacen_nombre: string;
  cantidad: number;
  stock_minimo: number;
  estado_stock: EstadoStock;
};

export type ProductoPorReponer = AlertaStock & { faltante: number };

export type MovimientoReciente = {
  id: number;
  tipo: TipoMovimiento;
  cantidad: number;
  referencia: string | null;
  creado_en: string;
  producto_nombre: string;
  producto_codigo: string;
  almacen_nombre: string;
  almacen_codigo: string;
  usuario_nombre: string;
};

export type Dashboard = {
  metricas: Metricas;
  graficas: Graficas;
  alertas: AlertaStock[];
  ultimos: MovimientoReciente[];
  top: ProductoPorReponer[];
};

// ----------------------------------------------------------------------
//  Usuarios
// ----------------------------------------------------------------------

export type Rol = {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: number;
  activo: number;
  usuarios?: number;
};

// ----------------------------------------------------------------------
//  Combos (menu de caja)
// ----------------------------------------------------------------------

export type TipoCombo = 'comida' | 'snack' | 'bebida';

/** Ingrediente fijo de la receta: se descuenta del stock al vender. */
export type ComboIngrediente = {
  producto_id: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  precio_compra: number;
  cantidad: number;
};

/** Extra opcional que el cliente puede pedir pagando un precio adicional. */
export type ComboOpcional = {
  producto_id: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  cantidad: number;
  precio_extra: number;
};

/** Entrada de receta al crear/editar un combo. */
export type ComboIngredienteEntrada = {
  producto_id: number;
  cantidad: number;
};

export type ComboOpcionalEntrada = {
  producto_id: number;
  cantidad: number;
  precio_extra: number;
};

export type Combo = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoCombo;
  precio_venta: number;
  requiere_cocina: number;
  activo: number;
  creado_en: string;
  // Solo en el listado:
  costo_estimado: number;
  n_ingredientes: number;
  n_opcionales: number;
  veces_vendido: number;
};

export type DetalleCombo = Combo & {
  ingredientes: ComboIngrediente[];
  opcionales: ComboOpcional[];
};

export type RespuestaCombos = {
  combos: Combo[];
};

export type RespuestaComboCreado = {
  id: number;
  mensaje: string;
};

/** Respuesta generica de crear/editar registros: casi todas devuelven esto. */
export type RespuestaGuardado = {
  id: number;
  mensaje: string;
};

// ----------------------------------------------------------------------
//  Ventas (caja / POS)
// ----------------------------------------------------------------------

export type EstadoVenta = 'completada' | 'cancelada';

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';

/** Linea que se envia al API al cobrar. */
export type ItemVentaEntrada = {
  combo_id: number;
  cantidad: number;
  /** Extras por encima de la receta base. */
  opcionales?: { producto_id: number; cantidad: number }[];
  /** Ingredientes de la receta que el cliente pidio quitar. */
  quitados?: { producto_id: number }[];
  notas?: string;
};

export type Venta = {
  id: number;
  codigo: string;
  cliente_nombre: string | null;
  metodo_pago: MetodoPago | null;
  subtotal: number;
  descuento: number;
  total: number;
  costo_total: number;
  estado: EstadoVenta;
  creado_en: string;
  almacen_id: number;
  almacen_nombre?: string;
  usuario_nombre?: string;
  n_items?: number;
};

// ----------------------------------------------------------------------
//  INGRESOS DE CAJA  (movimientos.php?vista=caja)
// ----------------------------------------------------------------------
//  La segunda seleccion de la pantalla Movimientos. No es mercaderia sino
//  dinero: una fila por venta cerrada con quien cobro, como cobro y
//  cuanto le quedo de ganancia al negocio.
// ----------------------------------------------------------------------

/** Una venta vista como entrada de dinero a la caja. */
export type IngresoCaja = {
  id: number;
  codigo: string;
  cliente_nombre: string | null;
  metodo_pago: MetodoPago;
  subtotal: number;
  descuento: number;
  total: number;
  costo_total: number;
  /** Ganancio real: lo que se cobro menos lo que costo hacer el combo. */
  ganancia: number;
  creado_en: string;
  cajero: string;
};

/** Cifras de un periodo (hoy o el mes en curso). */
export type ResumenIngresos = {
  ventas: number;
  total: number;
  ganancia: number;
  /** Parte del total que entro en efectivo (lo que queda en la gaveta). */
  efectivo: number;
};

export type ResumenCaja = {
  hoy: ResumenIngresos;
  mes: ResumenIngresos;
  por_metodo: { metodo_pago: MetodoPago; ventas: number; total: number; ganancia: number }[];
};

export type RespuestaCaja = {
  ingresos: IngresoCaja[];
  resumen: ResumenCaja;
  paginacion: Paginacion;
};

// ----------------------------------------------------------------------
//  PAGOS DE SERVICIOS  (pagos.php — dentro de Movimientos > Caja)
// ----------------------------------------------------------------------
//  Los retiros de dinero de la caja para los gastos del negocio: sueldos,
//  transporte, renta del local y servicios. Una fila por retiro con su
//  monto y una descripcion de para que fue. No toca stock.
// ----------------------------------------------------------------------

export type CategoriaPago = 'trabajadores' | 'transporte' | 'local' | 'servicios';

/** Retiro de dinero de la caja para pagar un gasto del negocio. */
export type PagoServicio = {
  id: number;
  codigo: string;
  categoria: CategoriaPago;
  monto: number;
  descripcion: string;
  creado_en: string;
  usuario_nombre: string;
};

/** Cifras de un periodo (hoy o el mes en curso). */
export type ResumenPagosPeriodo = {
  pagos: number;
  total: number;
};

export type ResumenPagos = {
  hoy: ResumenPagosPeriodo;
  mes: ResumenPagosPeriodo;
  por_categoria: { categoria: CategoriaPago; pagos: number; total: number }[];
};

export type RespuestaPagos = {
  pagos: PagoServicio[];
  resumen: ResumenPagos;
  paginacion: Paginacion;
};

export type RespuestaPagoCreado = {
  id: number;
  codigo: string;
  mensaje: string;
};

// ----------------------------------------------------------------------

export type RespuestaVentas = {
  ventas: Venta[];
  resumen: {
    hoy: { ventas: number; total: number };
    mes: { ventas: number; total: number };
  };
  paginacion: Paginacion;
};

export type PedidoCreado = {
  id: number;
  codigo: string;
  estado: EstadoPedido;
};

export type RespuestaCrearVenta = {
  id: number;
  codigo: string;
  subtotal: number;
  descuento: number;
  total: number;
  costo_total: number;
  pedido: PedidoCreado | null;
  /** Avisos informativos de stock bajo (no bloquean la venta). */
  avisos: string[];
};

// ----------------------------------------------------------------------
//  Pedidos (cola de cocina)
// ----------------------------------------------------------------------

export type EstadoPedido = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';

export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'pendiente',
  'en_preparacion',
  'listo',
  'entregado',
  'cancelado',
];

export type PedidoItem = {
  id: number;
  nombre: string;
  cantidad: number;
  /** Receta completa (base + extras) tal como se cobro. */
  ingredientes: ComboIngrediente[];
  /** Ingredientes que el cliente pidio quitar. */
  quitados: { producto_id: number; cantidad?: number; nombre: string | null }[];
};

export type Pedido = {
  id: number;
  codigo: string;
  venta_id: number;
  cliente_nombre: string | null;
  estado: EstadoPedido;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
  usuario_nombre: string;
  n_items: number;
  /** Minutos desde que se creo (lo calcula el listado). */
  espera_minutos?: number;
  /** Items del pedido (el listado ya los incluye; el detalle tambien). */
  items?: PedidoItem[];
};

export type RespuestaPedidos = {
  pedidos: Pedido[];
};

export type RespuestaPedidoAvanzado = {
  id: number;
  codigo: string;
  estado: EstadoPedido;
  mensaje?: string;
};

// ----------------------------------------------------------------------
//  Usuarios (gestion de cuentas)
// ----------------------------------------------------------------------

export type UsuarioTabla = Usuario & {
  activo: number;
  rol_id?: number;
  ultimo_acceso: string | null;
  creado_en: string;
  movimientos?: number;
};

export type RespuestaUsuarios = {
  usuarios: UsuarioTabla[];
  roles: Rol[];
};

export type RespuestaUsuarioGuardado = {
  id: number;
  mensaje: string;
};
