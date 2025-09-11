import sys
import subprocess
import json
from PyQt5.QtCore import Qt

from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QListWidget, QLabel, QPushButton, QMessageBox
)

def run_ros2_cmd(args):
    try:
        result = subprocess.run(['ros2'] + args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return result.stdout
    except Exception as e:
        return ""

def get_nodes():
    output = run_ros2_cmd(['node', 'list'])
    return [line.strip() for line in output.splitlines() if line.strip()]

def get_topics():
    output = run_ros2_cmd(['topic', 'list'])
    return [line.strip() for line in output.splitlines() if line.strip()]

def get_node_info(node_name):
    output = run_ros2_cmd(['node', 'info', node_name])
    info = {"Publishers": [], "Subscribers": [], "Services": []}
    current = None
    for line in output.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.endswith(':'):
            key = stripped[:-1]
            if key == "Publishers":
                current = "Publishers"
            elif key == "Subscribers":
                current = "Subscribers"
            elif key in ("Service Servers", "Service Clients"):
                current = "Services"
            else:
                current = None
        elif line.startswith(' '):
            if current and ':' in stripped:
                # Only take the topic/service name (before the colon)
                entry = stripped.split(':', 1)[0].strip()
                info[current].append(entry)
    return info

def get_topic_info(topic_name):
    output = run_ros2_cmd(['topic', 'info', topic_name, '--verbose'])
    info = {
        "Type": "",
        "Publisher count": "",
        "Subscriber count": "",
        "Publishers": [],
        "Subscribers": []
    }
    node_name = None
    node_namespace = None

    for line in output.splitlines():
        stripped = line.strip()
        if stripped.startswith('Type:'):
            info["Type"] = stripped.split(':', 1)[1].strip()
        elif stripped.startswith('Publisher count:'):
            info["Publisher count"] = stripped.split(':', 1)[1].strip()
        elif stripped.startswith('Subscription count:'):
            info["Subscriber count"] = stripped.split(':', 1)[1].strip()
        elif stripped.startswith('Node name:'):
            node_name = stripped.split(':', 1)[1].strip()
        elif stripped.startswith('Node namespace:'):
            node_namespace = stripped.split(':', 1)[1].strip()
        elif stripped.startswith('Endpoint type:'):
            endpoint_type = stripped.split(':', 1)[1].strip()
            full_node = (node_namespace or '') + '/' + (node_name or '')
            full_node = full_node.replace('//', '/').rstrip('/')
            if endpoint_type == "PUBLISHER":
                info["Publishers"].append(full_node)
            elif endpoint_type == "SUBSCRIPTION":
                info["Subscribers"].append(full_node)
            node_name = None
            node_namespace = None

    return info

class Ros2GraphInspector(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ROS2 Graph Inspector")
        self.resize(900, 500)
        self.layout = QHBoxLayout(self)

        # Left: Nodes and Topics
        self.left_layout = QVBoxLayout()
        self.node_list = QListWidget()
        self.topic_list = QListWidget()
        self.refresh_btn = QPushButton("Refresh")
        self.left_layout.addWidget(QLabel("Nodes"))
        self.left_layout.addWidget(self.node_list)
        self.left_layout.addWidget(QLabel("Topics"))
        self.left_layout.addWidget(self.topic_list)
        self.left_layout.addWidget(self.refresh_btn)
        self.layout.addLayout(self.left_layout, 2)

        # Right: Info
        self.info_label = QLabel("Select a node or topic to see details.")
        self.info_label.setAlignment(Qt.AlignTop)
        self.info_label.setWordWrap(True)
        self.info_label.linkActivated.connect(self.on_info_link_clicked)
        self.layout.addWidget(self.info_label, 2)

        self.refresh_btn.clicked.connect(self.refresh_lists)
        self.node_list.itemClicked.connect(self.on_node_selected)
        self.topic_list.itemClicked.connect(self.on_topic_selected)

        self.refresh_lists()

    def refresh_lists(self):
        self.node_list.clear()
        self.topic_list.clear()
        nodes = get_nodes()
        topics = get_topics()
        self.node_list.addItems(nodes)
        self.topic_list.addItems(topics)
        self.info_label.setText("Select a node or topic to see details.")

    def on_node_selected(self, item):
        node_name = item.text()
        info = get_node_info(node_name)
        text = f"<b>Node:</b> {node_name}<br><br>"
        for key in ["Subscribers", "Publishers", "Services"]:
            text += f"<b>{key}:</b><br>"
            if info[key]:
                for entry in info[key]:
                    # For topics, make them clickable if they exist in the topic list
                    if key in ["Publishers", "Subscribers"]:
                        if entry in [self.topic_list.item(i).text() for i in range(self.topic_list.count())]:
                            text += f"&nbsp;&nbsp;<a href='{entry}'>{entry}</a><br>"
                        else:
                            text += f"&nbsp;&nbsp;{entry}<br>"
                    else:
                        text += f"&nbsp;&nbsp;{entry}<br>"
            else:
                text += "&nbsp;&nbsp;<i>None</i><br>"
            text += "<br>"
        self.info_label.setText(text)

    def on_topic_selected(self, item):
        topic_name = item.text()
        info = get_topic_info(topic_name)
        text = f"<b>Topic:</b> {topic_name}<br><br>"
        for key in ["Type", "Publisher count", "Subscriber count"]:
            text += f"<b>{key}:</b> {info[key]}<br>"
        text += "<br><b>Publishers:</b><br>"
        if info["Publishers"]:
            for entry in info["Publishers"]:
                # Make publisher node clickable if it exists in the node list
                if entry in [self.node_list.item(i).text() for i in range(self.node_list.count())]:
                    text += f"&nbsp;&nbsp;<a href='{entry}'>{entry}</a><br>"
                else:
                    text += f"&nbsp;&nbsp;{entry}<br>"
        else:
            text += "&nbsp;&nbsp;<i>None</i><br>"
        text += "<br><b>Subscribers:</b><br>"
        if info["Subscribers"]:
            for entry in info["Subscribers"]:
                # Make subscriber node clickable if it exists in the node list
                if entry in [self.node_list.item(i).text() for i in range(self.node_list.count())]:
                    text += f"&nbsp;&nbsp;<a href='{entry}'>{entry}</a><br>"
                else:
                    text += f"&nbsp;&nbsp;{entry}<br>"
        else:
            text += "&nbsp;&nbsp;<i>None</i><br>"
        self.info_label.setText(text)

    def on_info_link_clicked(self, link):
        # Try to match node or topic name and show info recursively
        name = link
        print("Link clicked:", name)
        if name in [self.node_list.item(i).text() for i in range(self.node_list.count())]:
            print("Node clicked:", name)
            item = self.node_list.findItems(name, Qt.MatchExactly)[0]
            print("Setting current item in node list")
            self.node_list.setCurrentItem(item)
            print("Clearing topic selection")
            self.topic_list.clearSelection()
            print("Calling on_node_selected")
            self.on_node_selected(item)
        elif name in [self.topic_list.item(i).text() for i in range(self.topic_list.count())]:
            item = self.topic_list.findItems(name, Qt.MatchExactly)[0]
            self.topic_list.setCurrentItem(item)
            self.node_list.clearSelection()
            self.on_topic_selected(item)
        else:
            QMessageBox.information(self, "Info", f"Cannot find: {name}")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = Ros2GraphInspector()
    window.show()
    sys.exit(app.exec_())