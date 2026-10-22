import * as React from 'react';
import { Input } from './input';
import { formatearMontoPantalla, montoDesdePantalla } from '../../montos';

// Campo de valor con formato colombiano en vivo: mientras se escribe muestra "1.250.000,50" y
// al formulario le entrega el valor limpio ("1250000.5", ver montos.js), igual que un <Input>
// normal: onChange recibe un evento con e.target.value. La coma (o un punto escrito al final)
// abre los decimales (máximo 2); el punto de miles lo pone el campo solo.
const InputMoneda = React.forwardRef(({ value, onChange, ...props }, refExterno) => {
  const ref = React.useRef(null);
  const cursor = React.useRef(null); // dígitos a la izquierda del cursor tras el último cambio
  const pantalla = formatearMontoPantalla(value);

  React.useImperativeHandle(refExterno, () => ref.current);

  // Tras reformatear, deja el cursor después del mismo número de dígitos que tenía el usuario
  // (si no, saltaría al final al editar en medio del número).
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || cursor.current === null || document.activeElement !== el) return;
    let digitos = cursor.current;
    let pos = 0;
    while (pos < pantalla.length && digitos > 0) {
      if (/[\d,]/.test(pantalla[pos])) digitos--;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    cursor.current = null;
  }, [pantalla]);

  const cambiar = (e) => {
    const texto = e.target.value;
    const antesDelCursor = texto.slice(0, e.target.selectionStart ?? texto.length);
    cursor.current = (antesDelCursor.match(/[\d,]/g) || []).length + (/\.$/.test(antesDelCursor) && !texto.includes(',') ? 1 : 0);
    onChange?.({ target: { value: montoDesdePantalla(texto, pantalla), name: e.target.name, id: e.target.id } });
  };

  return <Input ref={ref} type="text" inputMode="decimal" autoComplete="off" value={pantalla} onChange={cambiar} {...props} />;
});
InputMoneda.displayName = 'InputMoneda';

export { InputMoneda };
