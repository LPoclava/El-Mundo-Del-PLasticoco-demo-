/** Rechaza si la promesa no termina a tiempo: una carga nunca debe quedar esperando para siempre. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, message = "El servidor tardó demasiado en responder."): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
