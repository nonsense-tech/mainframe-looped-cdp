import React, { Component } from 'react';
import {
  Typography,
  Layout,
  Row,
} from 'antd';

import Card from './components/Card';

import loopImage from './images/loop.svg';

import './App.scss';

const { Text } = Typography;
const { Header, Footer, Content } = Layout;

export default class App extends Component {
  render() {
    return (
      <Layout className="page-layout">
        <Header>
          <Row type="flex" className="header-row">
            <img src={loopImage} alt="" className="logo" />
            <Text className="logo-text">The Looper</Text>
          </Row>
        </Header>
        <Content>
          <Row>
            <Card />
          </Row>
        </Content>
        <Footer>
          <Row type="flex" justify="center">© 2019 Nonsense Technologies</Row>
        </Footer>
      </Layout>
    );
  }
}
