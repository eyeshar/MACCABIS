// Precarga (`node --import`) de pruebas:destino (norma 19): el script que se prueba no puede abrir ninguna conexion de
// red salvo a 127.0.0.1:<PRUEBAS_DESTINO_PUERTO> (el servidor falso de la prueba). Cada intento bloqueado se apunta en
// <PRUEBAS_DESTINO_MARCA> y la conexion falla: asi la prueba sabe si un script se ha intentado conectar, y aunque la
// guardia fallara, no llegaria a ningun servidor (tampoco al real, ni a produccion).
import fs from 'node:fs';
import net from 'node:net';

const PERMITIDO = Number(process.env.PRUEBAS_DESTINO_PUERTO) || 0;
const MARCA = process.env.PRUEBAS_DESTINO_MARCA;
const original = net.Socket.prototype.connect;

net.Socket.prototype.connect = function (...args) {
  // net.connect(...) llega aqui con los argumentos normalizados: [[opciones, cb]]
  const primero = Array.isArray(args[0]) ? args[0][0] : args[0];
  const o = primero && typeof primero === 'object' ? primero : { port: args[0], host: args[1] };
  if (o.path) return original.apply(this, args);   // tuberias locales (IPC), no red
  const host = o.host || 'localhost';
  const puerto = Number(o.port);
  if (host === '127.0.0.1' && puerto === PERMITIDO) return original.apply(this, args);
  if (MARCA) fs.appendFileSync(MARCA, `${host}:${puerto}\n`);
  process.nextTick(() => this.destroy(new Error(`pruebas:destino: conexión bloqueada a ${host}:${puerto}`)));
  return this;
};
