"""Diagnóstico de conectividad; no modifica calendarios."""
import concurrent.futures
import json
import platform
import socket
import subprocess
from pathlib import Path

URLS = [
    "https://colfarsfe.org.ar/",
    "http://colfarsfe.org.ar/",
    "https://www.colfarsfe.org.ar/",
    "http://www.colfarsfe.org.ar/",
    "https://colfarsfe.org.ar/wp-content/uploads/2026/09/Afiche-Turnos-Octubre-2026-.pdf",
    "https://esperanza.tur.ar/2016/12/12/farmacias-de-turno/",
]


def probe(url):
    result = subprocess.run([
        "curl", "-4", "-L", "-sS", "-o", "/dev/null",
        "--connect-timeout", "12", "--max-time", "25",
        "-w", "%{json}", url,
    ], capture_output=True, text=True, timeout=30)
    try:
        metrics = json.loads(result.stdout)
        metrics = {k: metrics.get(k) for k in (
            "http_code", "remote_ip", "url_effective", "time_namelookup",
            "time_connect", "time_appconnect", "time_total", "num_redirects")}
    except ValueError:
        metrics = {"output": result.stdout}
    return {"url": url, "exitCode": result.returncode,
            "error": result.stderr.strip(), **metrics}


def main():
    dns = {}
    for host in ("colfarsfe.org.ar", "www.colfarsfe.org.ar", "esperanza.tur.ar"):
        try:
            dns[host] = sorted(set(info[4][0] for info in socket.getaddrinfo(host, 443)))
        except OSError as error:
            dns[host] = str(error)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        probes = list(pool.map(probe, URLS))
    report = {"environment": platform.platform(), "dns": dns, "probes": probes}
    folder = Path("turnos-report")
    folder.mkdir(exist_ok=True)
    (folder / "connectivity.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
