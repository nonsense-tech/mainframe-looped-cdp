import React, { Component } from 'react';
import MainframeSDK from '@mainframe/sdk';
import Web3 from 'web3';

import {
  Button,
  Typography,
  Layout,
  Row,
  Col,
  InputNumber,
  Form,
  Divider,
  Tag,
  message,
  Skeleton,
} from 'antd';

import factoryABI from './contracts/Factory.json';
import exchangeABI from './contracts/Exchange.json';
import leverageABI from './contracts/Leverage.json';
import addresses from './addresses.json';

import './App.scss';

const { Text } = Typography;
const { Header, Footer, Content } = Layout;


const ValueRow = ({ label, value }) => (
  <Row type="flex" justify="space-between">
    <Text>{label}</Text>
    <Text>{value}</Text>
  </Row>
);
export default class App extends Component {
  state = {
    initialized: false,
    account: '',
    ethBalance: 0,
    ethPrice: 0,
    ethValue: null,
    percent: null,
    collateral: 0,
    debt: 0,
    liquidationPrice: 0,
    leverageContract: null,
    sending: false,
  }

  constructor() {
    super();
    this.sdk = new MainframeSDK();
    this.web3 = new Web3(this.sdk.ethereum.web3Provider);
  }

  fromWei(value) {
    return this.web3.utils.fromWei(String(value));
  }

  toWei(value) {
    return this.web3.utils.toWei(String(value));
  }

  async componentDidMount() {
    if (this.sdk.ethereum.web3Provider !== null) {
      this.sdk.ethereum.on('accountsChanged', () => {
        this.fetchState();
      })
      this.sdk.ethereum.on('networkChanged', () => {
        this.fetchState();
      })
      await this.initContracts();
      this.calculateValues();
      this.setState({ initialized: true });
    }
    this.fetchState();
  }

  async initContracts() {
    const { factoryAddress, daiAddress, leverageAddress } = addresses;
    const factoryContract = new this.web3.eth.Contract(
      factoryABI,
      factoryAddress,
    );
    const exchangeAddress = await factoryContract.methods
      .getExchange(daiAddress)
      .call();
    const exchangeContract = new this.web3.eth.Contract(
      exchangeABI,
      exchangeAddress,
    );
    const leverageContract = new this.web3.eth.Contract(
      leverageABI,
      leverageAddress,
    );

    const ethPrice = await exchangeContract.methods
      .getTokenToEthOutputPrice(this.toWei(1))
      .call();

    this.setState({
      ethPrice: Number(this.fromWei(ethPrice)),
      leverageContract,
    });
  }

  async fetchState() {
    const accounts = await this.web3.eth.getAccounts();
    if (accounts.length) {
      const account = accounts[0];
      const weiBalance = await this.web3.eth.getBalance(account);
      const ethBalance = this.fromWei(weiBalance);
      this.setState({
        account,
        ethBalance,
      });
    }
  }

  calculateValues() {
    const { ethPrice } = this.state;
    const percent = this.getPercent();
    const ethValue = this.getEthValue();
    const ratio = percent / 100;
    let currentValue = ethValue;
    let collateral = currentValue;
    for (let i = 0; i < 3; i++) {
      currentValue *= ratio;
      collateral += currentValue;
    }
    let debt = 0;
    currentValue = ethPrice;
    for (let i = 0; i < 4; i++) {
      currentValue *= ratio;
      debt += currentValue;
    }
    debt *= ethValue;
    const liquidationPrice = (debt / collateral / 2) * 3;
    this.setState({ collateral, debt, liquidationPrice });
  }

  changeEthValue = async value => {
    if (!Number(value)) return;
    await this.setState({ ethValue: Number(value) });
    this.calculateValues();
  }

  changePercentValue = async value => {
    if (!Number(value)) return;
    await this.setState({ percent: Number(value) });
    this.calculateValues();
  }

  sendingStart() {
    this.setState({ sending: true });
  }

  sendingEnd() {
    this.setState({ sending: false });
  }

  leverage = async () => {
    const { collateral, debt, leverageContract, account } = this.state;
    try {
      this.validate();
      this.sendingStart();
      const ethValue = this.getEthValue();
      await leverageContract.methods.riskNewCDP(
        this.toWei(collateral),
        this.toWei(debt),
        true,
      ).send({ value: this.toWei(ethValue), from: account });
      this.sendingEnd();
      message.success('Transaction sent');
    } catch (error) {
      this.sendingEnd();
      message.error(error.message);
    }
  }

  validate() {
    const ethValue = this.getEthValue();
    const percent = this.getPercent();
    if (ethValue > 0.1 || ethValue < 0.01 || percent > 60 || percent < 10) {
      throw Error('Wrong value.\nETH must be between 0.01 and 0.1.\nRatio must be between 10% and 60%');
    }
    if (this.state.ethBalance < ethValue) {
      throw Error('You have no enough ETH');
    }
  }

  getEthValue() {
    return this.state.ethValue || 0.1;
  }

  getPercent() {
    return this.state.percent || 50;
  }

  render() {
    const { ethPrice, collateral, debt, liquidationPrice } = this.state;
    const percent = this.getPercent();
    const ethValue = this.getEthValue();
    const isDanger = percent > 50;
    const disabled = !(ethValue && percent);
    return (
      <Layout style={{ height: '100vh', minHeight: 700 }}>
        <Header>
          <Row>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>Looped CDP</Text>
          </Row>
        </Header>
        <Content>
          <Row>
            <Col xxl={8} xl={7} lg={6} md={5} sm={4} xs={0}></Col>
            <Col xxl={8} xl={10} lg={12} md={14} sm={16} xs={24}>
              <Col className="card-container">
                {!this.state.initialized ? (
                  <div>
                    <Skeleton active />
                    <Skeleton active />
                    <Skeleton active />
                  </div>
                ) : (
                  <div>
                    <Row type="flex" justify="center" align="center">
                      <Text style={{ fontWeight: 'bold', fontSize: 20 }}>3x Loop</Text>
                    </Row>
                    <Divider />
                    <Row style={{ marginBottom: -20 }}>
                      <Form
                        labelCol={{ 'sm': 12 }}
                        wrapperCol={{ 'sm': 12 }}
                        layout="horizontal"
                      >
                        <Col span={12}>
                          <Form.Item label="ETH to lock">
                            <InputNumber
                              defaultValue={0.1}
                              min={0.01}
                              max={0.1}
                              formatter={value => `⧫ ${value}`}
                              parser={value => value.replace('⧫', '')}
                              onChange={this.changeEthValue}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="with ratio">
                            <InputNumber
                              defaultValue={50}
                              min={10}
                              max={60}
                              formatter={value => `${value}%`}
                              parser={value => value.replace('%', '')}
                              onChange={this.changePercentValue}
                            />
                          </Form.Item>
                        </Col>
                      </Form>
                    </Row>
                    <Divider style={{ margin: '15px 0' }} />
                    <ValueRow
                      label="Current ETH price"
                      value={`$${ethPrice.toFixed(2)}`}
                    />
                    <Divider style={{ margin: '15px 0' }} />
                    <ValueRow
                      label="Expected Collateral (ETH)"
                      value={collateral.toFixed(3)}
                    />
                    <Divider style={{ margin: '15px 0' }} />
                    <ValueRow
                      label="Expected Debt (DAI)"
                      value={`$${debt.toFixed(2)}`}
                    />
                    <Divider style={{ margin: '15px 0' }} />
                    <ValueRow
                      label="Expected Liquidation Price"
                      value={`$${liquidationPrice.toFixed(2)}`}
                    />
                    <Divider style={{ margin: '15px 0' }} />
                    <Row type="flex" justify="space-between">
                      <Text>Expected Status</Text>
                      {isDanger ? <Tag color="red">danger</Tag> : <Tag color="green">safe</Tag>}
                    </Row>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={this.leverage}
                      block
                      style={{ marginTop: 40 }}
                      loading={this.state.sending}
                    >Process</Button>
                  </div>
                )}
              </Col>
            </Col>
            <Col xxl={8} xl={7} lg={6} md={5} sm={4} xs={0}></Col>
          </Row>
        </Content>
        <Footer>
          <Row type="flex" justify="center">© 2019 Nonsense Technologies</Row>
        </Footer>
      </Layout>
    );
  }
}
