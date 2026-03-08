import logging
from kubernetes import client, config

logger = logging.getLogger(__name__)


def _get_apps_client():
    """Get a Kubernetes AppsV1Api client using in-cluster config."""
    config.load_incluster_config()
    return client.AppsV1Api()


def scale_app(namespace, app_name, replicas):
    """Scale all deployments and statefulsets matching the app to the given replicas.

    Finds resources with label app.kubernetes.io/name containing the app_name.
    Returns a list of scaled resources.
    """
    api = _get_apps_client()
    scaled = []

    # Scale deployments
    deployments = api.list_namespaced_deployment(
        namespace, label_selector=f"app.kubernetes.io/name={app_name}"
    )
    for dep in deployments.items:
        name = dep.metadata.name
        current = dep.spec.replicas
        if current == replicas:
            logger.info("Deployment %s/%s already at %d replicas", namespace, name, replicas)
            continue
        api.patch_namespaced_deployment_scale(
            name, namespace, {"spec": {"replicas": replicas}}
        )
        scaled.append({"kind": "Deployment", "name": name, "from": current, "to": replicas})
        logger.info("Scaled Deployment %s/%s: %d -> %d", namespace, name, current, replicas)

    # Scale statefulsets
    statefulsets = api.list_namespaced_stateful_set(
        namespace, label_selector=f"app.kubernetes.io/name={app_name}"
    )
    for sts in statefulsets.items:
        name = sts.metadata.name
        current = sts.spec.replicas
        if current == replicas:
            logger.info("StatefulSet %s/%s already at %d replicas", namespace, name, replicas)
            continue
        api.patch_namespaced_stateful_set_scale(
            name, namespace, {"spec": {"replicas": replicas}}
        )
        scaled.append({"kind": "StatefulSet", "name": name, "from": current, "to": replicas})
        logger.info("Scaled StatefulSet %s/%s: %d -> %d", namespace, name, current, replicas)

    # If no resources found with exact label, try broader search
    if not deployments.items and not statefulsets.items:
        # Try with app_name without -app suffix as label
        base_name = app_name.replace("-app", "")
        deployments = api.list_namespaced_deployment(namespace)
        for dep in deployments.items:
            if base_name in dep.metadata.name:
                name = dep.metadata.name
                current = dep.spec.replicas
                if current == replicas:
                    continue
                api.patch_namespaced_deployment_scale(
                    name, namespace, {"spec": {"replicas": replicas}}
                )
                scaled.append({"kind": "Deployment", "name": name, "from": current, "to": replicas})
                logger.info("Scaled Deployment %s/%s: %d -> %d (name match)", namespace, name, current, replicas)

        statefulsets = api.list_namespaced_stateful_set(namespace)
        for sts in statefulsets.items:
            if base_name in sts.metadata.name:
                name = sts.metadata.name
                current = sts.spec.replicas
                if current == replicas:
                    continue
                api.patch_namespaced_stateful_set_scale(
                    name, namespace, {"spec": {"replicas": replicas}}
                )
                scaled.append({"kind": "StatefulSet", "name": name, "from": current, "to": replicas})
                logger.info("Scaled StatefulSet %s/%s: %d -> %d (name match)", namespace, name, current, replicas)

    return scaled
