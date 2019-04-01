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
  Alert,
} from 'antd';

import loopImage from './images/loop.svg';

import factoryABI from './contracts/Factory.json';
import exchangeABI from './contracts/Exchange.json';
import leverageABI from './contracts/Leverage.json';
import addresses from './addresses.json';

import './App.scss';

const { Text } = Typography;
const { Header, Footer, Content } = Layout;

const ListOfValues = ({ data }) =>
  data.map((item, index) => (
    <Row key={index}>
      {index > 0 && <Divider className="divider" />}
      <Row type="flex" justify="space-between">
        <Text>{item.text}</Text>
        <Text>{item.value}</Text>
      </Row>
    </Row>
  ));

class CustomForm extends Component {
  validateEthValue = (rule, value, callback) => {
    if (value && value >= 0.01 && value <= 0.1) {
      callback();
    } else {
      callback('The Looper has a limit of 0.1 ETH per transaction.');
    }
  }
  validatePercent = (rule, value, callback) => {
    if (value && value >= 10 && value <= 60) {
      callback();
    } else {
      callback('Rate must be between 10 and 60');
    }
  }
  render() {
    const {
      form: {
        getFieldDecorator,
      },
      changeEthValue,
      changePercentValue,
    } = this.props;
    return (
      <div className="form-container">
        <Form>
          <Col span={11}>
            <Form.Item label="ETH to lock">
              {getFieldDecorator('ethValue', {
                rules: [{
                  validator: this.validateEthValue,
                }],
                initialValue: 0.1,
              })(
                <InputNumber
                  formatter={value => `⧫ ${value}`}
                  parser={value => value.replace('⧫', '')} 
                  onChange={changeEthValue}
                  className="input"
                  size="large"
                />
              )}
            </Form.Item>
          </Col>
          <Col span={2} />
          <Col span={11}>
            <Form.Item label="Rehypothecation rate">
              {getFieldDecorator('percentValue', {
                rules: [{
                  validator: this.validatePercent,
                }],
                initialValue: 50,
              })(
                <InputNumber
                  formatter={value => `${value} %`}
                  parser={value => value.replace('%', '')}
                  onChange={changePercentValue}
                  className="input"
                  size="large"
                />
              )}
            </Form.Item>
          </Col>
        </Form>
      </div>
    );
  }
}

const WrappedForm = Form.create({ name: 'register' })(CustomForm);
export default class App extends Component {
  state = {
    initialized: false,
    account: '',
    ethBalance: 0,
    ethPrice: 0,
    ethValue: 0.1,
    percent: 50,
    collateral: 0,
    debt: 0,
    liquidationPrice: 0,
    leverageContract: null,
    sending: false,
    returnValue: 0,
    collateralizationRate: 0,
  }

  constructor() {
    super();
    this.sdk = new MainframeSDK();
    this.web3 = new Web3(this.sdk.ethereum.web3Provider);
    this.formRef = React.createRef();
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
    const percent = this.state.percent;
    const ethValue = this.state.ethValue;
    console.log(ethValue);
    
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
    const returnValue = debt - ((collateral - ethValue) * ethPrice);
    const collateralizationRate = Math.round(100 / (percent / 100));
    const liquidationPrice = ((debt / collateral / 2) * 3) || 0;
    this.setState({
      collateral,
      debt,
      liquidationPrice,
      returnValue,
      collateralizationRate,
    });
  }

  changeEthValue = async value => {
    if (typeof value !== 'number') return;
    await this.setState({ ethValue: Number(value) });
    this.calculateValues();
  }

  changePercentValue = async value => {
    if (typeof value !== 'number') return;
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
      const ethValue = this.state.ethValue;
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
    const ethValue = this.state.ethValue;
    const percent = this.state.percent;
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
    const {
      ethPrice,
      collateral,
      debt,
      liquidationPrice,
      returnValue,
      collateralizationRate,
    } = this.state;
    const percent = this.state.percent;
    // const ethValue = this.getEthValue();
    const isDanger = percent > 50;
    const labelColor = isDanger ? 'red' : 'green';
    const labelText = isDanger ? 'danger' : 'safe';
    const label = isDanger ? <Tag color="red">danger</Tag> : <Tag color="green">safe</Tag>;
    // const disabled = !(ethValue && percent);
    let disabled = false;

    if (this.formRef.current) {
      const errors = this.formRef.current.getFieldsError(['ethValue', 'percentValue']);
      disabled = errors.ethValue || errors.percentValue;
    }

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
                    <Col align="center">
                      <Text className="title">
                        Leveraged Collateralized
                      </Text>
                      <br />
                      <Text className="title">
                        Debt Position
                      </Text>
                    </Col>
                    {/* <Divider /> */}
                    <WrappedForm
                      ref={this.formRef}
                      changeEthValue={this.changeEthValue}
                      changePercentValue={this.changePercentValue}
                    />
                    <ListOfValues
                      data={[
                        {
                          text: 'Current ETH price',
                          value: `$${ethPrice.toFixed(2)}`,
                        },
                        {
                          text: 'Expected Collateral (ETH)',
                          value: collateral.toFixed(3),
                        },
                        {
                          text: 'Expected Debt (DAI)',
                          value: debt.toFixed(2),
                        },
                        {
                          text: 'Expected Change (DAI)',
                          value: returnValue.toFixed(2),
                        },
                        {
                          text: 'Expected Liquidation Price',
                          value: `$${liquidationPrice.toFixed(2)}`,
                        },
                        {
                          text: 'Expected Collateralization Rate',
                          value: `${collateralizationRate}%`,
                        },
                        {
                          text: 'Expected Status',
                          value: <Tag color={labelColor} className="tag">{labelText}</Tag>,
                        },
                      ]}
                    />
                    <Alert
                      message="The final values may slightly differ from this calculator due to exchange rate volatility and slippage."
                      type="info"
                      showIcon
                      className="alert"
                    />
                    <Button
                      className="button"
                      type="primary"
                      disabled={disabled}
                      onClick={this.leverage}
                      block
                      loading={this.state.sending}
                    >Loop it!</Button>
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
