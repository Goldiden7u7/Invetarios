import type { PedidoItem, ComboIngrediente } from 'src/types/inventario';

// ----------------------------------------------------------------------

export type IngredienteAPreparar = {
  producto_id: number;
  nombre: string;
  cantidad: number;
  unidad_medida: string;
};

// ----------------------------------------------------------------------

/**
 * Ingredientes que la cocina REALMENTE tiene que preparar.
 *
 * Cada item guarda la receta completa (base + extras) y, aparte, lo que el
 * cliente quito. Si pintamos la receta tal cual, el cocinero ve ingredientes
 * que nadie va a comer: hay que restar lo quitado antes de mostrarlo.
 *
 * `cantidad` viene por item (no por unidad): 2 hamburguesas con 1 cada una
 * guardan 1, y la cocina debe leer "1 Filete" por unidad de comida.
 */
export function ingredientesAPreparar(item: PedidoItem): IngredienteAPreparar[] {
  const porProducto = new Map<number, ComboIngrediente>();

  // 1) Agrupamos por producto: si un extra repite un producto que ya viene en
  //    la receta, suma cantidades en vez de duplicar la linea.
  for (const ingrediente of item.ingredientes ?? []) {
    const previo = porProducto.get(ingrediente.producto_id);

    if (previo) {
      porProducto.set(ingrediente.producto_id, {
        ...previo,
        cantidad: previo.cantidad + ingrediente.cantidad,
      });
    } else {
      porProducto.set(ingrediente.producto_id, { ...ingrediente });
    }
  }

  // 2) Restamos lo que el cliente quito. Los registros anteriores a esta
  //    version no traen 'cantidad', y en ese caso se quito el ingrediente
  //    completo (la Caja siempre manda la cantidad de la receta).
  for (const quitado of item.quitados ?? []) {
    const previo = porProducto.get(quitado.producto_id);

    if (!previo) {
      continue;
    }

    const restante = previo.cantidad - (quitado.cantidad ?? previo.cantidad);

    if (restante > 0) {
      porProducto.set(quitado.producto_id, { ...previo, cantidad: restante });
    } else {
      porProducto.delete(quitado.producto_id);
    }
  }

  return [...porProducto.values()];
}

/** Texto corto de un item para la vista compacta: "1x Jugo, 2x Hamburguesa". */
export function resumenItem(item: PedidoItem): string {
  return `${item.cantidad}x ${item.nombre}`;
}
