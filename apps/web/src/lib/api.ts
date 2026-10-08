export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      ...(body !== undefined
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
  } catch {
    throw new Error("Sem conexão. Confira sua internet e tente novamente.");
  }
  const data = await res
    .json()
    .catch(() => ({ message: "O serviço não respondeu. Tente novamente." }));
  if (!res.ok)
    throw new ApiError(res.status, data.message ?? "Não conseguimos concluir.");
  return data as T;
}
export async function download(path: string, name: string) {
  const res = await fetch("/api" + path, { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message ?? "Não foi possível exportar.");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
