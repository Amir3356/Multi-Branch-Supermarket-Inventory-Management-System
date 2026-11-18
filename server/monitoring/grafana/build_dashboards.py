"""Builds the Grafana dashboards in ./dashboards. Edit this file, then run from server/monitoring/grafana:
    python3 build_dashboards.py dashboards
Grafana reloads the files within about 10 seconds; no restart needed."""
import json, os, sys

OUT = sys.argv[1]
PROM = {"type": "prometheus", "uid": "prometheus"}
TEMPO = {"type": "tempo", "uid": "tempo"}
LOKI = {"type": "loki", "uid": "loki"}
TAG = "supermarket"

# Joins cAdvisor / Docker metrics to compose service names
BY_SERVICE = 'on (container_id) group_left(service) docker_container_info'

DASHBOARDS = [
    ("sm-home", "Supermarket Monitoring", "Start here: every monitoring dashboard of the system"),
    ("supermarket-overview", "System Overview", "Health of the whole system at a glance"),
    ("sm-microservices", "Microservices Monitoring", "Each microservice: up/down, traffic, errors, gRPC calls between services, CPU, memory, Node.js runtime"),
    ("sm-api", "API Performance Monitoring", "API latency, throughput and error rate of the REST API"),
    ("sm-database", "Database Monitoring", "PostgreSQL: connections, transactions, cache hit ratio, tables, slowest queries"),
    ("sm-cache", "Cache Monitoring", "Redis cache: hit ratio, memory, keys, evictions, command times"),
    ("sm-kafka", "Event Streaming Monitoring", "Apache Kafka: topics, throughput, consumer lag, outbox, dead-letter queue"),
    ("sm-logs", "Logs Monitoring", "Logs of every container (Loki): volume, errors, warnings, live search"),
    ("sm-network", "Network Monitoring", "Network traffic per service, Docker network, API gateway connections"),
    ("sm-tracing", "Distributed Tracing", "Traces (Tempo): service graph, recent, slow and failed requests"),
]
TITLE = {uid: title for uid, title, _ in DASHBOARDS}


class Board:
    def __init__(self, uid, title, description, variables=()):
        self.uid, self.title, self.description = uid, title, description
        self.panels, self.y, self.id = [], 0, 0
        self.variables = list(variables)

    def _id(self):
        self.id += 1
        return self.id

    def row(self, title):
        self.panels.append({"type": "row", "title": title, "id": self._id(), "collapsed": False,
                            "gridPos": {"h": 1, "w": 24, "x": 0, "y": self.y}, "panels": []})
        self.y += 1

    def place(self, panels, h):
        """Lays panels out side by side on one row; each panel gives its width."""
        x = 0
        for p in panels:
            p["gridPos"] = {"h": h, "w": p.pop("_w"), "x": x, "y": self.y}
            p["id"] = self._id()
            x += p["gridPos"]["w"]
            self.panels.append(p)
        self.y += h

    def json(self):
        return {"uid": self.uid, "title": self.title, "description": self.description, "tags": [TAG],
                "timezone": "browser", "schemaVersion": 39, "version": 1, "editable": False,
                "refresh": "30s", "time": {"from": "now-1h", "to": "now"}, "graphTooltip": 1,
                "links": [{"title": "All dashboards", "type": "dashboards", "tags": [TAG], "asDropdown": True,
                           "includeVars": False, "keepTime": True, "icon": "apps"}],
                "templating": {"list": self.variables}, "annotations": {"list": []}, "panels": self.panels}


GREEN = {"mode": "absolute", "steps": [{"color": "green", "value": None}]}
def bad_above(warn, crit):
    return {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": warn}, {"color": "red", "value": crit}]}
def good_above(warn, ok):
    return {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "orange", "value": warn}, {"color": "green", "value": ok}]}


def stat(title, expr, w=4, unit="none", decimals=None, th=None, desc="", no_value=None, ds=PROM, link=None):
    p = {"_w": w, "type": "stat", "title": title, "description": desc, "datasource": ds,
         "targets": [{"refId": "A", "expr": expr, "datasource": ds, "instant": True}],
         "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                     "colorMode": "value", "graphMode": "area", "textMode": "value", "justifyMode": "center"},
         "fieldConfig": {"defaults": {"unit": unit, "thresholds": th or GREEN, "color": {"mode": "thresholds"}}, "overrides": []}}
    if decimals is not None: p["fieldConfig"]["defaults"]["decimals"] = decimals
    if no_value: p["fieldConfig"]["defaults"]["noValue"] = no_value
    if link: p["links"] = [{"title": f"Open {TITLE[link]}", "url": f"/d/{link}"}]
    if ds is LOKI: p["targets"][0]["queryType"] = "instant"
    return p


def ts(title, targets, w=12, unit="none", desc="", stack=False, bars=False, ds=PROM, legend="table", fill=10):
    return {"_w": w, "type": "timeseries", "title": title, "description": desc, "datasource": ds,
            "targets": [{"refId": chr(65 + i), "expr": e, "legendFormat": l, "datasource": ds} for i, (e, l) in enumerate(targets)],
            "options": {"legend": {"displayMode": legend, "placement": "bottom" if legend == "list" else "right",
                                   "calcs": [] if legend == "list" else ["lastNotNull", "max"]},
                        "tooltip": {"mode": "multi", "sort": "desc"}},
            "fieldConfig": {"defaults": {"unit": unit, "custom": {
                "drawStyle": "bars" if bars else "line", "lineWidth": 2, "fillOpacity": 70 if bars else fill,
                "showPoints": "never", "stacking": {"mode": "normal" if stack else "none"}}}, "overrides": []}}


def table(title, expr, w=12, desc="", rename=None, unit=None, color_field=None, th=None, sort=None):
    p = {"_w": w, "type": "table", "title": title, "description": desc, "datasource": PROM,
         "targets": [{"refId": "A", "expr": expr, "instant": True, "format": "table", "datasource": PROM}],
         "transformations": [{"id": "organize", "options": {"excludeByName": {"Time": True, "__name__": True, "job": True, "instance": True}, "renameByName": rename or {}}}],
         "options": {"showHeader": True, "sortBy": [sort] if sort else []},
         "fieldConfig": {"defaults": {"custom": {"align": "left"}}, "overrides": []}}
    if unit: p["fieldConfig"]["overrides"].append({"matcher": {"id": "byName", "options": (rename or {}).get("Value", "Value")}, "properties": [{"id": "unit", "value": unit}]})
    if color_field:
        p["fieldConfig"]["overrides"].append({"matcher": {"id": "byName", "options": color_field}, "properties": [
            {"id": "custom.cellOptions", "value": {"type": "color-background"}}, {"id": "thresholds", "value": th}]})
    return p


def gauge(title, expr, w=4, unit="percent", th=None, desc="", mx=100):
    return {"_w": w, "type": "gauge", "title": title, "description": desc, "datasource": PROM,
            "targets": [{"refId": "A", "expr": expr, "datasource": PROM, "instant": True}],
            "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}, "showThresholdMarkers": True},
            "fieldConfig": {"defaults": {"unit": unit, "min": 0, "max": mx, "thresholds": th or GREEN}, "overrides": []}}


def traces(title, query, w=12, desc=""):
    return {"_w": w, "type": "table", "title": title, "description": desc, "datasource": TEMPO,
            "targets": [{"refId": "A", "datasource": TEMPO, "queryType": "traceql", "query": query, "limit": 20, "tableType": "traces"}],
            "options": {"showHeader": True}, "fieldConfig": {"defaults": {"custom": {"align": "left"}}, "overrides": []}}


def service_graph(w=24):
    return {"_w": w, "type": "nodeGraph", "title": "Service graph",
            "description": "Which service calls which (from traces): request rate and errors on each connection",
            "datasource": TEMPO, "targets": [{"refId": "A", "datasource": TEMPO, "queryType": "serviceMap"}], "options": {}}


def logs(title, expr, w=24, desc=""):
    return {"_w": w, "type": "logs", "title": title, "description": desc, "datasource": LOKI,
            "targets": [{"refId": "A", "expr": expr, "datasource": LOKI, "queryType": "range"}],
            "options": {"showTime": True, "wrapLogMessage": True, "sortOrder": "Descending", "enableLogDetails": True, "prettifyLogMessage": False, "dedupStrategy": "none"}}


def text(content, w=24, title=""):
    return {"_w": w, "type": "text", "title": title, "options": {"mode": "markdown", "content": content}}


def var_query(name, label, query, ds=PROM, multi=True, all_value=".*"):
    return {"name": name, "label": label, "type": "query", "datasource": ds, "query": query, "refresh": 2,
            "includeAll": True, "multi": multi, "allValue": all_value, "current": {"text": "All", "value": "$__all"}, "sort": 1}


SERVICE_VAR = var_query("service", "Service", {"query": "label_values(http_requests_total, service)", "refId": "v"})
S = 'service=~"$service"'

boards = []

# 1. Index ---------------------------------------------------------------------------------------------------------
b = Board("sm-home", "Supermarket Monitoring", "Start here: every monitoring dashboard of the system")
b.place([text(
    "### Multi-Branch Supermarket Inventory — monitoring\n"
    "Pick a dashboard below. Every dashboard also has an **All dashboards** menu at the top right.\n\n"
    "| Dashboard | What it answers |\n|---|---|\n" +
    "\n".join(f"| [{t}](/d/{u}) | {d} |" for u, t, d in DASHBOARDS[1:]),
    w=14, title="Dashboards"),
    {"_w": 10, "type": "dashlist", "title": "All dashboards",
     "options": {"showStarred": False, "showRecentlyViewed": False, "showSearch": True, "showHeadings": False,
                 "maxItems": 20, "query": "", "tags": [TAG], "includeVars": False, "keepTime": True}}], 13)
b.row("Health right now")
b.place([
    stat("Services up", 'count(up{job="services"} == 1)', th=good_above(8, 9), desc="Microservices answering (9 = all)", link="sm-microservices"),
    stat("Server errors (5xx)", '(100 * sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) or vector(0)', unit="percent", decimals=2, th=bad_above(1, 5), link="sm-api"),
    stat("p95 response time", 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))', unit="s", decimals=3, th=bad_above(0.5, 2), link="sm-api"),
    stat("Database", 'pg_up', th=good_above(1, 1), desc="1 = PostgreSQL is answering", link="sm-database"),
    stat("Kafka consumer lag", 'sum(clamp_min(kafka_consumergroup_lag, 0)) or vector(0)', th=bad_above(10, 100), desc="Events still waiting to be read", link="sm-kafka"),
    stat("Errors in logs (15 min)", 'sum(count_over_time({project="server", level="error"}[15m])) or vector(0)', ds=LOKI, th=bad_above(1, 10), link="sm-logs"),
], 5)
boards.append(b)

# 2. System overview ------------------------------------------------------------------------------------------------
b = Board("supermarket-overview", "System Overview", "Health of the whole system at a glance")
b.row("Overview")
b.place([
    stat("Services up", 'count(up{job="services"} == 1)', th=good_above(8, 9), link="sm-microservices"),
    stat("Requests / s", 'sum(rate(http_requests_total[1m]))', unit="reqps", decimals=2, link="sm-api"),
    stat("Server errors (5xx)", '(100 * sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) or vector(0)', unit="percent", decimals=2, th=bad_above(1, 5), link="sm-api"),
    stat("p95 response time", 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))', unit="s", decimals=3, th=bad_above(0.5, 2), link="sm-api"),
    stat("Cache hit ratio", '100 * sum(increase(cache_requests_total{result="hit"}[1h])) / sum(increase(cache_requests_total{result=~"hit|miss"}[1h])) > -1', unit="percent", decimals=1, th=good_above(50, 80), no_value="No lookups yet", link="sm-cache"),
    stat("Kafka consumer lag", 'sum(clamp_min(kafka_consumergroup_lag, 0)) or vector(0)', th=bad_above(10, 100), link="sm-kafka"),
], 4)
b.place([
    stat("Audit outbox backlog", 'sum(audit_outbox_pending)', th=bad_above(10, 100), link="sm-kafka"),
    stat("DB connections", 'sum(pg_stat_database_numbackends{datname="multi_branch_supermarket"})', link="sm-database"),
    stat("Containers memory", 'sum(container_memory_working_set_bytes{container_id!=""})', unit="bytes", link="sm-microservices"),
    stat("Gateway connections", 'nginx_connections_active', link="sm-network"),
    stat("Log errors (15 min)", 'sum(count_over_time({project="server", level="error"}[15m])) or vector(0)', ds=LOKI, th=bad_above(1, 10), link="sm-logs"),
    stat("Log warnings (15 min)", 'sum(count_over_time({project="server", level="warn"}[15m])) or vector(0)', ds=LOKI, th=bad_above(5, 50), link="sm-logs"),
], 4)
b.row("Traffic")
b.place([
    ts("Requests per service", [('sum by (service) (rate(http_requests_total[1m]))', '{{service}}')], unit="reqps"),
    ts("p95 response time per service", [('histogram_quantile(0.95, sum by (le, service) (rate(http_request_duration_seconds_bucket[5m])))', '{{service}}')], unit="s"),
], 8)
b.place([service_graph()], 10)
boards.append(b)

# 3. Microservices --------------------------------------------------------------------------------------------------
b = Board("sm-microservices", "Microservices Monitoring", "Each microservice: up/down, traffic, errors, CPU, memory, Node.js runtime", [SERVICE_VAR])
b.row("Status")
b.place([
    table("Service status", 'up{job="services"}', w=8, rename={"Value": "Up (1 = yes)", "instance": "Service"}, color_field="Up (1 = yes)", th=good_above(1, 1), desc="1 = answering Prometheus, 0 = down"),
    ts("Requests per service", [(f'sum by (service) (rate(http_requests_total{{{S}}}[1m]))', '{{service}}')], w=16, unit="reqps"),
], 9)
b.place([
    ts("Server errors (5xx) per service", [(f'sum by (service) (rate(http_requests_total{{{S}, status=~"5.."}}[5m]))', '{{service}}')], unit="reqps"),
    ts("Client errors (4xx) per service", [(f'sum by (service) (rate(http_requests_total{{{S}, status=~"4.."}}[5m]))', '{{service}}')], unit="reqps", desc="Validation errors, missing records, not signed in"),
], 8)
b.row("Resources (process)")
b.place([
    ts("Memory (resident)", [(f'process_resident_memory_bytes{{job="services", {S}}}', '{{service}}')], w=8, unit="bytes"),
    ts("CPU", [(f'rate(process_cpu_seconds_total{{job="services", {S}}}[1m])', '{{service}}')], w=8, unit="percentunit"),
    ts("Event-loop delay (p99)", [(f'nodejs_eventloop_lag_p99_seconds{{job="services", {S}}}', '{{service}}')], w=8, unit="s", desc="High values mean a service is blocked by slow work"),
], 8)
b.row("Node.js runtime")
b.place([
    ts("Heap used", [(f'nodejs_heap_size_used_bytes{{job="services", {S}}}', '{{service}}')], w=8, unit="bytes"),
    ts("Garbage collection time", [(f'sum by (service) (rate(nodejs_gc_duration_seconds_sum{{job="services", {S}}}[5m]))', '{{service}}')], w=8, unit="s"),
    ts("Open handles (sockets, timers)", [(f'nodejs_active_handles_total{{job="services", {S}}}', '{{service}}')], w=8),
], 8)
b.row("Service-to-service calls (gRPC)")
b.place([
    stat("gRPC calls / s", 'sum(rate(grpc_server_handled_total[5m])) or vector(0)', w=6, unit="ops", decimals=2, desc="Internal calls between services (proto/supermarket.proto)"),
    stat("gRPC errors (1 h)", 'sum(increase(grpc_server_handled_total{grpc_code!~"OK|NOT_FOUND|FAILED_PRECONDITION|INVALID_ARGUMENT"}[1h])) or vector(0)', w=6, decimals=0, th=bad_above(1, 10), desc="Calls that failed for a technical reason (refused, unavailable, internal); expected answers such as not found or not enough stock aren't counted"),
    stat("gRPC p95 time", 'histogram_quantile(0.95, sum by (le) (rate(grpc_server_handling_seconds_bucket[5m])))', w=6, unit="s", decimals=3),
    stat("Refused calls (1 h)", 'sum(increase(grpc_server_handled_total{grpc_code="PERMISSION_DENIED"}[1h])) or vector(0)', w=6, decimals=0, th=bad_above(1, 5), desc="Calls without the right internal secret"),
], 4)
b.place([
    ts("gRPC calls per method", [('sum by (grpc_service, grpc_method) (rate(grpc_server_handled_total[5m]))', '{{grpc_service}}/{{grpc_method}}')], w=8, unit="ops"),
    ts("gRPC answers by status", [('sum by (grpc_code) (rate(grpc_server_handled_total[5m]))', '{{grpc_code}}')], w=8, unit="ops", stack=True, desc="OK, or the status a failure kept from its HTTP meaning (NOT_FOUND = 404, FAILED_PRECONDITION = 422 …)"),
    ts("gRPC time per method (p95)", [('histogram_quantile(0.95, sum by (le, grpc_service, grpc_method) (rate(grpc_server_handling_seconds_bucket[5m])))', '{{grpc_service}}/{{grpc_method}}')], w=8, unit="s"),
], 8)
b.row("Containers (all, including infrastructure)")
b.place([
    ts("Container CPU", [(f'sum by (service) (rate(container_cpu_usage_seconds_total{{container_id!=""}}[1m]) * {BY_SERVICE})', '{{service}}')], unit="percentunit"),
    ts("Container memory", [(f'sum by (service) (container_memory_working_set_bytes{{container_id!=""}} * {BY_SERVICE})', '{{service}}')], unit="bytes"),
], 9)
b.place([service_graph()], 10)
boards.append(b)

# 4. API performance ------------------------------------------------------------------------------------------------
b = Board("sm-api", "API Performance Monitoring", "API latency, throughput and error rate of the REST API", [SERVICE_VAR])
R = f'{S}, route!="unmatched"'
BUCKETS = f'rate(http_request_duration_seconds_bucket{{{S}}}[5m])'
ALL = f'sum(rate(http_requests_total{{{S}}}[5m]))'
ERR5 = f'sum(rate(http_requests_total{{{S}, status=~"5.."}}[5m]))'
ERR4 = f'sum(rate(http_requests_total{{{S}, status=~"4.."}}[5m]))'

b.row("API Latency — how long requests take")
b.place([
    stat("Average", f'sum(rate(http_request_duration_seconds_sum{{{S}}}[5m])) / sum(rate(http_request_duration_seconds_count{{{S}}}[5m]))', unit="s", decimals=3, desc="Mean response time over the last 5 minutes"),
    stat("p50 (median)", f'histogram_quantile(0.50, sum by (le) ({BUCKETS}))', unit="s", decimals=3, desc="Half of the requests are faster than this"),
    stat("p90", f'histogram_quantile(0.90, sum by (le) ({BUCKETS}))', unit="s", decimals=3, th=bad_above(0.3, 1)),
    stat("p95", f'histogram_quantile(0.95, sum by (le) ({BUCKETS}))', unit="s", decimals=3, th=bad_above(0.5, 2), desc="95% of the requests are faster than this"),
    stat("p99", f'histogram_quantile(0.99, sum by (le) ({BUCKETS}))', unit="s", decimals=3, th=bad_above(1, 3), desc="The slowest 1% take longer than this"),
    stat("Requests under 250 ms", f'100 * sum(rate(http_request_duration_seconds_bucket{{{S}, le="0.25"}}[5m])) / sum(rate(http_request_duration_seconds_count{{{S}}}[5m]))', unit="percent", decimals=1, th=good_above(90, 99), desc="Share of requests answered within a quarter of a second"),
], 4)
b.place([
    ts("Latency percentiles over time", [
        (f'histogram_quantile(0.50, sum by (le) ({BUCKETS}))', 'p50'),
        (f'histogram_quantile(0.90, sum by (le) ({BUCKETS}))', 'p90'),
        (f'histogram_quantile(0.95, sum by (le) ({BUCKETS}))', 'p95'),
        (f'histogram_quantile(0.99, sum by (le) ({BUCKETS}))', 'p99'),
        (f'sum(rate(http_request_duration_seconds_sum{{{S}}}[5m])) / sum(rate(http_request_duration_seconds_count{{{S}}}[5m]))', 'average')], unit="s"),
    ts("p95 latency per service", [(f'histogram_quantile(0.95, sum by (le, service) ({BUCKETS}))', '{{service}}')], unit="s"),
], 8)
b.place([
    {"_w": 12, "type": "heatmap", "title": "Latency distribution", "description": "How many requests fell into each response-time range (darker = more)", "datasource": PROM,
     "targets": [{"refId": "A", "expr": f'sum by (le) (increase(http_request_duration_seconds_bucket{{{S}}}[1m]))', "format": "heatmap", "legendFormat": "{{le}}", "datasource": PROM}],
     "options": {"calculate": False, "yAxis": {"unit": "s"}, "color": {"scheme": "Oranges", "mode": "scheme"}, "cellGap": 1, "tooltip": {"show": True, "yHistogram": True}},
     "fieldConfig": {"defaults": {}, "overrides": []}},
    table("Slowest routes (p95, last 15 min)", f'topk(15, histogram_quantile(0.95, sum by (le, service, method, route) (rate(http_request_duration_seconds_bucket{{{R}}}[15m]))))', rename={"Value": "p95 (s)", "service": "Service", "method": "Method", "route": "Route"}, sort={"displayName": "p95 (s)", "desc": True}),
], 10)

b.row("Throughput — how many requests are handled")
b.place([
    stat("Requests / s", f'sum(rate(http_requests_total{{{S}}}[1m]))', unit="reqps", decimals=2),
    stat("Requests / min", f'sum(rate(http_requests_total{{{S}}}[1m])) * 60', decimals=0),
    stat("Requests (last hour)", f'sum(increase(http_requests_total{{{S}}}[1h]))', decimals=0),
    stat("Peak requests / s (1 h)", f'max_over_time(sum(rate(http_requests_total{{{S}}}[1m]))[1h:1m])', unit="reqps", decimals=2),
    stat("Gateway requests / s", 'rate(nginx_http_requests_total[1m])', unit="reqps", decimals=2, desc="Everything reaching the API gateway (nginx)"),
    stat("Gateway connections", 'nginx_connections_active'),
], 4)
b.place([
    ts("Throughput per service", [(f'sum by (service) (rate(http_requests_total{{{S}}}[1m]))', '{{service}}')], unit="reqps", stack=True),
    ts("Throughput by method", [(f'sum by (method) (rate(http_requests_total{{{S}}}[1m]))', '{{method}}')], unit="reqps", stack=True, desc="GET = reads; POST / PATCH / PUT / DELETE = changes"),
], 8)
b.place([
    table("Busiest routes (requests / s, last 15 min)", f'topk(15, sum by (service, method, route) (rate(http_requests_total{{{R}}}[15m])))', rename={"Value": "Requests / s", "service": "Service", "method": "Method", "route": "Route"}, sort={"displayName": "Requests / s", "desc": True}),
    ts("Gateway throughput", [('rate(nginx_http_requests_total[1m])', 'requests / s'), ('rate(nginx_connections_accepted[1m])', 'new connections / s')], unit="ops"),
], 9)

b.row("Error Rate — how many requests fail")
b.place([
    stat("Error rate (all errors)", f'(100 * ({ERR5} + {ERR4}) / {ALL}) or vector(0)', unit="percent", decimals=2, th=bad_above(5, 15), desc="Share of responses with a 4xx or 5xx status"),
    stat("Server error rate (5xx)", f'(100 * {ERR5} / {ALL}) or vector(0)', unit="percent", decimals=2, th=bad_above(1, 5), desc="Failures of the system itself"),
    stat("Client error rate (4xx)", f'(100 * {ERR4} / {ALL}) or vector(0)', unit="percent", decimals=2, th=bad_above(10, 25), desc="Rejected requests: validation errors, not signed in, not found"),
    stat("Availability (1 h)", f'(100 * (1 - sum(increase(http_requests_total{{{S}, status=~"5.."}}[1h])) / sum(increase(http_requests_total{{{S}}}[1h])))) or vector(100)', unit="percent", decimals=3, th=good_above(99, 99.9), desc="Share of requests in the last hour that didn't fail with a server error"),
    stat("5xx errors (1 h)", f'sum(increase(http_requests_total{{{S}, status=~"5.."}}[1h])) or vector(0)', decimals=0, th=bad_above(1, 10)),
    stat("4xx errors (1 h)", f'sum(increase(http_requests_total{{{S}, status=~"4.."}}[1h])) or vector(0)', decimals=0),
], 4)
b.place([
    ts("Error rate over time", [(f'(100 * {ERR5} / {ALL}) or vector(0)', 'server errors (5xx) %'), (f'(100 * {ERR4} / {ALL}) or vector(0)', 'client errors (4xx) %')], unit="percent"),
    ts("Error rate per service (5xx)", [(f'(100 * sum by (service) (rate(http_requests_total{{{S}, status=~"5.."}}[5m])) / sum by (service) (rate(http_requests_total{{{S}}}[5m])))', '{{service}}')], unit="percent", desc="Empty when no service has failed"),
], 8)
b.place([
    ts("Responses by status code", [(f'sum by (status) (rate(http_requests_total{{{S}}}[1m]))', '{{status}}')], unit="reqps", stack=True),
    table("Routes with errors (last 15 min)", f'sum by (service, method, route, status) (increase(http_requests_total{{{S}, status=~"[45].."}}[15m])) > 0', rename={"Value": "Responses", "service": "Service", "method": "Method", "route": "Route", "status": "Status"}, sort={"displayName": "Responses", "desc": True}),
], 9)
boards.append(b)

# 5. Database -------------------------------------------------------------------------------------------------------
b = Board("sm-database", "Database Monitoring", "PostgreSQL: connections, transactions, cache hit ratio, tables, slowest queries")
D = 'datname="multi_branch_supermarket"'
b.row("Summary")
b.place([
    stat("PostgreSQL", 'pg_up', th=good_above(1, 1), desc="1 = answering"),
    stat("Connections", f'sum(pg_stat_database_numbackends{{{D}}})'),
    gauge("Connections used", f'100 * sum(pg_stat_database_numbackends) / max(pg_settings_max_connections)', th=bad_above(70, 90), desc="Share of max_connections in use"),
    gauge("Buffer cache hit ratio", f'100 * sum(rate(pg_stat_database_blks_hit{{{D}}}[5m])) / (sum(rate(pg_stat_database_blks_hit{{{D}}}[5m])) + sum(rate(pg_stat_database_blks_read{{{D}}}[5m])))', th=good_above(90, 99), desc="Share of reads served from memory (should stay above 99%)"),
    stat("Database size", f'pg_database_size_bytes{{{D}}}', unit="bytes"),
    stat("Deadlocks (1 h)", f'sum(increase(pg_stat_database_deadlocks{{{D}}}[1h])) or vector(0)', th=bad_above(1, 5)),
], 5)
b.row("Activity")
b.place([
    ts("Connections by state", [(f'sum by (state) (pg_stat_activity_count{{{D}}})', '{{state}}')], stack=True),
    ts("Transactions / s", [(f'sum(rate(pg_stat_database_xact_commit{{{D}}}[1m]))', 'commits'), (f'sum(rate(pg_stat_database_xact_rollback{{{D}}}[1m]))', 'rollbacks')], unit="ops"),
], 8)
b.place([
    ts("Rows / s", [(f'sum(rate(pg_stat_database_tup_fetched{{{D}}}[1m]))', 'fetched'), (f'sum(rate(pg_stat_database_tup_inserted{{{D}}}[1m]))', 'inserted'),
                    (f'sum(rate(pg_stat_database_tup_updated{{{D}}}[1m]))', 'updated'), (f'sum(rate(pg_stat_database_tup_deleted{{{D}}}[1m]))', 'deleted')], unit="ops"),
    ts("Longest running transaction", [(f'max by (state) (pg_stat_activity_max_tx_duration{{{D}}})', '{{state}}')], unit="s", desc="A long one can hold locks and slow everyone else"),
], 8)
b.place([
    ts("Locks by mode", [(f'sum by (mode) (pg_locks_count{{{D}}})', '{{mode}}')], stack=True),
    ts("Temporary files written", [(f'rate(pg_stat_database_temp_bytes{{{D}}}[5m])', 'temp bytes')], unit="Bps", desc="Queries spilling to disk (sorting, hashing)"),
], 8)
b.row("Tables & queries")
b.place([
    table("Largest tables (rows)", 'topk(15, sum by (relname) (pg_stat_user_tables_n_live_tup{datname="multi_branch_supermarket"}))', rename={"Value": "Rows", "relname": "Table"}, sort={"displayName": "Rows", "desc": True}),
    table("Slowest queries (p95, from traces)", 'topk(15, histogram_quantile(0.95, sum by (le, service, span_name) (rate(traces_spanmetrics_latency_bucket{span_name=~"pg .*"}[15m]))))', rename={"Value": "p95 (s)", "service": "Service", "span_name": "Query"}, sort={"displayName": "p95 (s)", "desc": True}, desc="Per SQL command and table, measured by OpenTelemetry"),
], 10)
b.place([
    ts("Queries / s per service (from traces)", [('sum by (service) (rate(traces_spanmetrics_calls_total{span_name=~"pg .*"}[5m]))', '{{service}}')], unit="ops"),
    ts("Sequential vs index scans", [(f'sum(rate(pg_stat_user_tables_seq_scan{{{D}}}[5m]))', 'sequential scans'), (f'sum(rate(pg_stat_user_tables_idx_scan{{{D}}}[5m]))', 'index scans')], unit="ops", desc="Many sequential scans on big tables can mean a missing index"),
], 8)
boards.append(b)

# 6. Cache ----------------------------------------------------------------------------------------------------------
b = Board("sm-cache", "Cache Monitoring", "Redis cache: hit ratio, memory, keys, evictions, command times")
b.row("Summary")
b.place([
    stat("Redis", 'redis_up', th=good_above(1, 1), desc="1 = answering"),
    gauge("App cache hit ratio (1 h)", '100 * sum(increase(cache_requests_total{result="hit"}[1h])) / sum(increase(cache_requests_total{result=~"hit|miss"}[1h]))', th=good_above(50, 80), desc="Lookups the services answered from Redis instead of PostgreSQL"),
    gauge("Memory used", '100 * redis_memory_used_bytes / redis_memory_max_bytes', th=bad_above(80, 95), desc="Share of the 128 MB limit; when full, the least recently used keys are dropped"),
    stat("Keys", 'sum(redis_db_keys)'),
    stat("Connected clients", 'redis_connected_clients'),
    stat("Evicted keys (1 h)", 'increase(redis_evicted_keys_total[1h])', th=bad_above(1, 100), desc="Keys dropped because memory was full"),
], 5)
b.row("Lookups")
b.place([
    ts("App cache lookups", [('sum by (result) (rate(cache_requests_total[5m]))', '{{result}}')], unit="ops", stack=True, desc="hit = answered from Redis; miss = read from PostgreSQL then cached; error = Redis unavailable"),
    ts("Lookups per service", [('sum by (service, result) (rate(cache_requests_total[5m]))', '{{service}} {{result}}')], unit="ops"),
], 8)
b.place([
    ts("Redis keyspace hits / misses", [('rate(redis_keyspace_hits_total[5m])', 'hits'), ('rate(redis_keyspace_misses_total[5m])', 'misses')], unit="ops"),
    ts("Redis command time (p95, from traces)", [('histogram_quantile(0.95, sum by (le, span_name) (rate(traces_spanmetrics_latency_bucket{span_name=~"redis .*"}[5m])))', '{{span_name}}')], unit="s"),
], 8)
b.row("Server")
b.place([
    ts("Memory", [('redis_memory_used_bytes', 'used'), ('redis_memory_max_bytes', 'limit')], w=8, unit="bytes"),
    ts("Commands / s", [('rate(redis_commands_processed_total[1m])', 'commands')], w=8, unit="ops"),
    ts("Keys expired / evicted", [('rate(redis_expired_keys_total[5m])', 'expired'), ('rate(redis_evicted_keys_total[5m])', 'evicted')], w=8, unit="ops"),
], 8)
boards.append(b)

# 7. Event streaming ------------------------------------------------------------------------------------------------
b = Board("sm-kafka", "Event Streaming Monitoring", "Apache Kafka: topics, throughput, consumer lag, outbox, dead-letter queue")
T = 'topic!~"__.*"'
b.row("Summary")
b.place([
    stat("Brokers", 'kafka_brokers', th=good_above(1, 1)),
    stat("Topics", f'count(kafka_topic_partitions{{{T}}})'),
    stat("Consumer lag", 'sum(clamp_min(kafka_consumergroup_lag, 0)) or vector(0)', th=bad_above(10, 100), desc="Events still waiting to be read"),
    stat("Audit outbox backlog", 'sum(audit_outbox_pending)', th=bad_above(10, 100), desc="Audit entries not yet published to Kafka"),
    stat("Dead-letter events", 'sum(kafka_topic_partition_current_offset{topic="audit.events.dlq"}) or vector(0)', th=bad_above(1, 10), desc="Audit events rejected by reporting-service (audit.events.dlq)"),
    stat("Failed sends (1 h)", 'sum(increase(kafka_messages_total{direction="produced", result="failed"}[1h])) or vector(0)', th=bad_above(1, 10)),
], 4)
b.row("Throughput")
b.place([
    ts("Events written per topic", [(f'sum by (topic) (rate(kafka_topic_partition_current_offset{{{T}}}[5m]))', '{{topic}}')], unit="ops"),
    ts("Produced / consumed by the services", [('sum by (topic, direction) (rate(kafka_messages_total{result="ok"}[5m]))', '{{topic}} {{direction}}')], unit="ops"),
], 8)
b.place([
    ts("Consumer lag per group", [('sum by (consumergroup, topic) (clamp_min(kafka_consumergroup_lag, 0))', '{{consumergroup}} ← {{topic}}')], desc="0 = caught up"),
    ts("Event processing time (p95, from traces)", [('histogram_quantile(0.95, sum by (le, span_name) (rate(traces_spanmetrics_latency_bucket{span_name=~"process .*"}[5m])))', '{{span_name}}')], unit="s"),
], 8)
b.row("Reliability")
b.place([
    ts("Failed sends / reads", [('sum by (topic, direction) (rate(kafka_messages_total{result="failed"}[5m]))', '{{topic}} {{direction}}')], unit="ops"),
    ts("Audit outbox backlog per service", [('audit_outbox_pending', '{{service}}')]),
], 8)
b.place([
    table("Topics & partitions", f'sum by (topic) (kafka_topic_partitions{{{T}}})', rename={"Value": "Partitions", "topic": "Topic"}),
    table("Events stored per topic", f'sum by (topic) (kafka_topic_partition_current_offset{{{T}}})', rename={"Value": "Events (offset)", "topic": "Topic"}),
], 7)
b.place([
    ts("Kafka container CPU", [(f'sum by (service) (rate(container_cpu_usage_seconds_total{{container_id!=""}}[1m]) * {BY_SERVICE.replace("docker_container_info", "docker_container_info{service=~\"kafka.*\"}")})', '{{service}}')], unit="percentunit"),
    ts("Kafka container memory", [(f'sum by (service) (container_memory_working_set_bytes{{container_id!=""}} * {BY_SERVICE.replace("docker_container_info", "docker_container_info{service=~\"kafka.*\"}")})', '{{service}}')], unit="bytes"),
], 8)
boards.append(b)

# 8. Logs -----------------------------------------------------------------------------------------------------------
LOG_SERVICE = var_query("service", "Service", {"label": "service", "refId": "LokiVariableQueryEditor-VariableQuery", "stream": "", "type": 1}, ds=LOKI)
LOG_LEVEL = var_query("level", "Level", {"label": "level", "refId": "LokiVariableQueryEditor-VariableQuery", "stream": "", "type": 1}, ds=LOKI)
SEARCH = {"name": "search", "label": "Search text", "type": "textbox", "query": "", "current": {"text": "", "value": ""}}
b = Board("sm-logs", "Logs Monitoring", "Logs of every container (Loki): volume, errors, warnings, live search", [LOG_SERVICE, LOG_LEVEL, SEARCH])
LS = 'project="server", service=~"$service"'
b.row("Summary")
b.place([
    stat("Log lines (15 min)", f'sum(count_over_time({{{LS}}}[15m])) or vector(0)', ds=LOKI, w=6),
    stat("Errors (15 min)", f'sum(count_over_time({{{LS}, level="error"}}[15m])) or vector(0)', ds=LOKI, w=6, th=bad_above(1, 10)),
    stat("Warnings (15 min)", f'sum(count_over_time({{{LS}, level="warn"}}[15m])) or vector(0)', ds=LOKI, w=6, th=bad_above(5, 50)),
    stat("Containers logging", f'count(sum by (service) (count_over_time({{{LS}}}[15m])))', ds=LOKI, w=6),
], 4)
b.row("Volume")
b.place([
    ts("Log lines per service", [(f'sum by (service) (count_over_time({{{LS}}}[1m]))', '{{service}}')], ds=LOKI, bars=True, stack=True),
    ts("Errors & warnings per service", [(f'sum by (service, level) (count_over_time({{{LS}, level=~"error|warn"}}[5m]))', '{{service}} {{level}}')], ds=LOKI, bars=True, stack=True),
], 8)
b.row("Logs")
b.place([logs("Errors and warnings", f'{{{LS}, level=~"error|warn"}} |~ "(?i)$search"', desc="Newest first; open a line to see its details")], 10)
b.place([logs("All logs (filter with Service, Level and Search text above)", f'{{{LS}, level=~"$level|"}} |~ "(?i)$search"')], 14)
boards.append(b)

# 9. Network --------------------------------------------------------------------------------------------------------
b = Board("sm-network", "Network Monitoring", "Network traffic per service, Docker network, API gateway connections")
N = 'service!=""'
b.row("Summary")
b.place([
    stat("Received (all containers)", f'sum(rate(docker_container_network_receive_bytes_total{{{N}}}[1m]))', unit="Bps"),
    stat("Sent (all containers)", f'sum(rate(docker_container_network_transmit_bytes_total{{{N}}}[1m]))', unit="Bps"),
    stat("Packet errors (1 h)", f'sum(increase(docker_container_network_receive_errors_total{{{N}}}[1h]) + increase(docker_container_network_transmit_errors_total{{{N}}}[1h])) or vector(0)', th=bad_above(1, 100)),
    stat("Dropped packets (1 h)", f'sum(increase(docker_container_network_receive_dropped_total{{{N}}}[1h]) + increase(docker_container_network_transmit_dropped_total{{{N}}}[1h])) or vector(0)', th=bad_above(1, 100)),
    stat("Gateway connections", 'nginx_connections_active'),
    stat("Gateway requests / s", 'rate(nginx_http_requests_total[1m])', unit="reqps", decimals=2),
], 4)
b.row("Traffic per service")
b.place([
    ts("Received per service", [(f'sum by (service) (rate(docker_container_network_receive_bytes_total{{{N}}}[1m]))', '{{service}}')], unit="Bps"),
    ts("Sent per service", [(f'sum by (service) (rate(docker_container_network_transmit_bytes_total{{{N}}}[1m]))', '{{service}}')], unit="Bps"),
], 9)
b.place([
    table("Top talkers (last 15 min)", f'topk(15, sum by (service) (increase(docker_container_network_receive_bytes_total{{{N}}}[15m]) + increase(docker_container_network_transmit_bytes_total{{{N}}}[15m])))', rename={"Value": "Bytes in + out", "service": "Service"}, unit="bytes", sort={"displayName": "Bytes in + out", "desc": True}),
    ts("Packets per service", [(f'sum by (service) (rate(docker_container_network_receive_packets_total{{{N}}}[1m]) + rate(docker_container_network_transmit_packets_total{{{N}}}[1m]))', '{{service}}')], unit="pps"),
], 9)
b.row("Docker network & host")
b.place([
    ts("Docker network bridge (whole project)", [('sum(rate(container_network_receive_bytes_total{id="/", interface=~"br-.*"}[1m]))', 'received'), ('sum(rate(container_network_transmit_bytes_total{id="/", interface=~"br-.*"}[1m]))', 'sent')], unit="Bps"),
    ts("Errors & drops per service", [(f'sum by (service) (rate(docker_container_network_receive_errors_total{{{N}}}[5m]) + rate(docker_container_network_transmit_errors_total{{{N}}}[5m]) + rate(docker_container_network_receive_dropped_total{{{N}}}[5m]) + rate(docker_container_network_transmit_dropped_total{{{N}}}[5m]))', '{{service}}')], unit="pps"),
], 8)
b.row("API gateway (nginx)")
b.place([
    ts("Connections", [('nginx_connections_active', 'active'), ('nginx_connections_reading', 'reading'), ('nginx_connections_writing', 'writing'), ('nginx_connections_waiting', 'idle (keep-alive)')]),
    ts("Connections accepted / handled", [('rate(nginx_connections_accepted[1m])', 'accepted'), ('rate(nginx_connections_handled[1m])', 'handled')], unit="ops", desc="Accepted but not handled means nginx ran out of resources"),
], 8)
boards.append(b)

# 10. Tracing -------------------------------------------------------------------------------------------------------
b = Board("sm-tracing", "Distributed Tracing", "Traces (Tempo): service graph, recent, slow and failed requests")
b.row("Service graph")
b.place([service_graph()], 11)
b.row("Requests (from traces)")
b.place([
    ts("Requests per service", [('sum by (service) (rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]))', '{{service}}')], unit="reqps"),
    ts("p95 per service", [('histogram_quantile(0.95, sum by (le, service) (rate(traces_spanmetrics_latency_bucket{span_kind="SPAN_KIND_SERVER"}[5m])))', '{{service}}')], unit="s"),
], 8)
b.row("Traces — click a trace ID to open its timeline")
b.place([
    traces("Recent requests", '{ kind = server }', desc="The latest requests across all services"),
    traces("Slow requests (over 500 ms)", '{ kind = server && duration > 500ms }'),
], 10)
b.place([
    traces("Failed requests", '{ status = error }', desc="Spans marked as errors (5xx responses, failed queries or calls)"),
    traces("Database queries over 100 ms", '{ span.db.system = "postgresql" && duration > 100ms }'),
], 10)
boards.append(b)

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".json"):
        os.remove(os.path.join(OUT, f))
for i, bd in enumerate(boards):
    name = f"{i:02d}-{bd.uid}.json"
    with open(os.path.join(OUT, name), "w") as fh:
        json.dump(bd.json(), fh, indent=2)
    print(f"{name:<34} {bd.title:<30} {len([p for p in bd.panels if p['type'] != 'row'])} panels")
