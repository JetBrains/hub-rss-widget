import DashboardAddons from 'hub-dashboard-addons';
import convert from 'xml-js';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {render} from 'react-dom';
import Input from '@jetbrains/ring-ui/components/input/input';
import Link from '@jetbrains/ring-ui/components/link/link';
import Panel from '@jetbrains/ring-ui/components/panel/panel';
import Button from '@jetbrains/ring-ui/components/button/button';

import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved
import styles from './app.css';


class Widget extends Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  constructor(props) {
    super(props);
    const {registerWidgetApi, dashboardApi} = props;

    this.state = {
      isConfiguring: false,
      error: null,
      json: null,
      rss: ''
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true}),
      onRefresh: this.refresh
    });

    this.initialize(dashboardApi);
  }

  initialize(dashboardApi) {
    dashboardApi.readConfig().then(config => {
      if (!config) {
        dashboardApi.enterConfigMode();
        this.setState({isConfiguring: true});
        return;
      }
      this.setState({rss: config.rss});
      this.refresh();
    });
  }

  saveConfig = async () => {
    const {rss} = this.state;
    await this.props.dashboardApi.storeConfig({rss});
    this.setState({isConfiguring: false});
    this.refresh();
  };

  cancelConfig = async () => {
    const {dashboardApi} = this.props;

    const config = await dashboardApi.readConfig();
    if (!config) {
      dashboardApi.removeWidget();
    } else {
      this.setState({isConfiguring: false});
      await dashboardApi.exitConfigMode();
    }
  };

  changeRss = event => {
    this.setState({rss: event.target.value});
  };

  refresh = () => {
    const {rss} = this.state;

    this.setState({
      error: null,
      json: null
    });

    return fetch(`http://cors-proxy.htmldriven.com/?url=${rss}`).
      then(response => response.json()).
      then(json => {
        if (!json || !json.success) { // eslint-disable-line no-magic-numbers
          throw new Error(json.error);
        }

        return json.body;
      }).
      then(xml => {
        const json = convert.xml2js(xml, {compact: true});

        this.setState({
          json
        });
      }).
      catch(error => {
        this.setState({error});
      });
  };

  renderConfiguration() {
    return (
      <div className={styles.widget}>
        <Input
          value={this.state.rss}
          onChange={this.changeRss}
          placeholder="RSS feed url"
        />
        <Panel>
          <Button blue={true} onClick={this.saveConfig}>{'Save'}</Button>
          <Button onClick={this.cancelConfig}>{'Cancel'}</Button>
        </Panel>
      </div>
    );
  }

  render() {
    const {rss, error, json, isConfiguring} = this.state;

    if (isConfiguring) {
      return this.renderConfiguration();
    }

    return (
      <div className={styles.widget}>
        {!rss && <div>{'Please set up correct rss source in widget settings'}</div>}
        {Boolean(error) && <div>{'Requested url can\'t be loaded'}</div>}
        {Boolean(json) && <div>
          {json.rss.channel.item.map(item => { //eslint-disable-line arrow-body-style
            const content = {__html: item.description._cdata ||
              item.description._text || ''};

            return (<div style={{marginBottom: '24px'}} key={item.guid._text}>
              <h3 className="itemTitle">
                <Link href={item.link._text}>{item.title._text}</Link>
              </h3>
              <div dangerouslySetInnerHTML={content}/>
            </div>);
          })}
        </div>}
      </div>
    );
  }
}

DashboardAddons.registerWidget((dashboardApi, registerWidgetApi) =>
  render(
    <Widget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app-container')
  )
);
