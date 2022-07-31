/* eslint-disable no-mixed-spaces-and-tabs */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dimensions,
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  InteractionManager,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import PropTypes from 'prop-types';
import QRCode from 'react-native-qrcode-svg';
import ScrollableTabView, {
  DefaultTabBar,
} from 'react-native-scrollable-tab-view';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { connect } from 'react-redux';
import AsyncStorage from '@react-native-community/async-storage';
import ActionView from '../../UI/ActionView';
import ButtonReveal from '../../UI/ButtonReveal';
import { getNavigationOptionsTitle } from '../../UI/Navbar';
import InfoModal from '../../UI/Swaps/components/InfoModal';
import useScreenshotWarning from '../../hooks/useScreenshotWarning';
import { showAlert } from '../../../actions/alert';
import { WRONG_PASSWORD_ERROR } from '../../../constants/error';
import {
  SRP_GUIDE_URL,
  NON_CUSTODIAL_WALLET_URL,
  KEEP_SRP_SAFE_URL,
} from '../../../constants/urls';
import ClipboardManager from '../../../core/ClipboardManager';
import { useTheme } from '../../../util/theme';
import Engine from '../../../core/Engine';
import PreventScreenshot from '../../../core/PreventScreenshot';
import SecureKeychain from '../../../core/SecureKeychain';
import { BIOMETRY_CHOICE } from '../../../constants/storage';
import AnalyticsV2 from '../../../util/analyticsV2';
import Device from '../../../util/device';
import { strings } from '../../../../locales/i18n';
import { isQRHardwareAccount } from '../../../util/address';
import AppConstants from '../../../core/AppConstants';
import { createStyles } from './styles';

const PRIVATE_KEY = 'private_key';
// const SEED_PHRASE = 'seed_phrase';

/**
 * View that displays private account information as private key or seed phrase
 */
const RevealPrivateCredential = ({
  navigation,
  showAlert,
  selectedAddress,
  credentialName,
  cancel,
  route,
  navBarDisabled,
}) => {
  const [clipboardPrivateCredential, setClipboardPrivateCredential] =
    useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [isUserUnlocked, setIsUserUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [warningIncorrectPassword, setWarningIncorrectPassword] = useState('');
  const [isAndroidSupportedVersion, setIsAndroidSupportedVersion] =
    useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const { colors, themeAppearance } = useTheme();
  const styles = createStyles(colors);

  const privateCredentialName =
    credentialName || route.params.privateCredentialName;

  const openSRPGuide = () => {
    AnalyticsV2.trackEvent(AnalyticsV2.ANALYTICS_EVENTS.SCREENSHOT_WARNING);
    Linking.openURL(SRP_GUIDE_URL);
  };

  const showScreenshotAlert = useCallback(() => {
    AnalyticsV2.trackEvent(AnalyticsV2.ANALYTICS_EVENTS.SCREENSHOT_WARNING);
    Alert.alert(
      strings('reveal_credential.screenshot_warning_title'),
      strings('reveal_credential.screenshot_warning_desc', {
        credentialName:
          privateCredentialName === PRIVATE_KEY
            ? strings('reveal_credential.private_key_text')
            : strings('reveal_credential.srp_abbreviation_text'),
      }),
      [
        {
          text: strings('reveal_credential.learn_more'),
          onPress: openSRPGuide,
          style: 'cancel',
        },
        {
          text: strings('reveal_credential.got_it'),
          onPress: () =>
            AnalyticsV2.trackEvent(AnalyticsV2.ANALYTICS_EVENTS.SCREENSHOT_OK),
        },
      ],
    );
  }, [privateCredentialName]);

  const [enableScreenshotWarning] = useScreenshotWarning(showScreenshotAlert);

  const updateNavBar = () => {
    if (navBarDisabled) {
      return;
    }
    navigation.setOptions(
      getNavigationOptionsTitle(
        strings(
          `reveal_credential.${
            route.params?.privateCredentialName ?? ''
          }_title`,
        ),
        navigation,
        false,
        colors,
      ),
    );
  };

  const tryUnlockWithPassword = async (password, privateCredentialName) => {
    const { KeyringController } = Engine.context;
    const isPrivateKeyReveal = privateCredentialName === PRIVATE_KEY;

    try {
      let privateCredential;
      if (!isPrivateKeyReveal) {
        const mnemonic = await KeyringController.exportSeedPhrase(
          password,
        ).toString();
        privateCredential = JSON.stringify(mnemonic).replace(/"/g, '');
      } else {
        privateCredential = await KeyringController.exportAccount(
          password,
          selectedAddress,
        );
      }

      if (privateCredential && (isUserUnlocked || isPrivateKeyReveal)) {
        setClipboardPrivateCredential(privateCredential);
        enableScreenshotWarning(true);
        setUnlocked(true);
      }
    } catch (e) {
      let msg = strings('reveal_credential.warning_incorrect_password');
      if (isQRHardwareAccount(selectedAddress)) {
        msg = strings('reveal_credential.hardware_error');
      } else if (
        e.toString().toLowerCase() !== WRONG_PASSWORD_ERROR.toLowerCase()
      ) {
        msg = strings('reveal_credential.unknown_error');
      }

      setIsModalVisible(false);
      enableScreenshotWarning(false);
      setUnlocked(false);
      setWarningIncorrectPassword(msg);
    }
  };

  useEffect(() => {
    updateNavBar();

    const unlockWithBiometrics = async () => {
      const biometryType = await SecureKeychain.getSupportedBiometryType();
      if (!this.props.passwordSet) {
        this.tryUnlockWithPassword('');
      } else if (biometryType) {
        const biometryChoice = await AsyncStorage.getItem(BIOMETRY_CHOICE);
        if (biometryChoice !== '' && biometryChoice === biometryType) {
          const credentials = await SecureKeychain.getGenericPassword();
          if (credentials) {
            this.tryUnlockWithPassword(credentials.password);
          }
        }
      }
    };

    unlockWithBiometrics();
    InteractionManager.runAfterInteractions(() => {
      PreventScreenshot.forbid();
    });

    return () => {
      InteractionManager.runAfterInteractions(() => {
        PreventScreenshot.allow();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPrivateKey = () => {
    const credential = credentialName || route.params.privateCredentialName;
    return credential === PRIVATE_KEY;
  };

  const navigateBack = () => {
    navigation.pop();
  };

  const cancelReveal = () => {
    if (!unlocked)
      AnalyticsV2.trackEvent(
        isPrivateKey()
          ? AnalyticsV2.ANALYTICS_EVENTS.REVEAL_PRIVATE_KEY_CANCELLED
          : AnalyticsV2.ANALYTICS_EVENTS.REVEAL_SRP_CANCELLED,
        { view: 'Enter password' },
      );

    if (cancel) return cancel();
    navigateBack();
  };

  const tryUnlock = () => {
    setIsModalVisible(true);
  };

  const onPasswordChange = (password) => {
    setPassword(password);
  };

  const copyPrivateCredentialToClipboard = async (privateCredentialName) => {
    AnalyticsV2.trackEvent(
      privateCredentialName === PRIVATE_KEY
        ? AnalyticsV2.ANALYTICS_EVENTS.REVEAL_PRIVATE_KEY_COMPLETED
        : AnalyticsV2.ANALYTICS_EVENTS.REVEAL_SRP_COMPLETED,
      { action: 'copied to clipboard' },
    );

    await ClipboardManager.setStringExpire(clipboardPrivateCredential);

    const msg = `${strings(
      `reveal_credential.${privateCredentialName}_copied_${Platform.OS}`,
    )}${
      Device.isIos()
        ? strings(`reveal_credential.${privateCredentialName}_copied_time`)
        : ''
    }`;

    showAlert({
      isVisible: true,
      autodismiss: 1500,
      content: 'clipboard-alert',
      data: {
        msg,
        width: '70%',
      },
    });
  };

  const revealCredential = (privateCredentialName) => {
    tryUnlockWithPassword(password, privateCredentialName);
    setIsUserUnlocked(true);
    setIsModalVisible(false);
  };

  const renderTabBar = () => (
    <DefaultTabBar
      underlineStyle={styles.tabUnderlineStyle}
      activeTextColor={colors.primary.default}
      inactiveTextColor={colors.text.alternative}
      backgroundColor={colors.background.default}
      tabStyle={styles.tabStyle}
      textStyle={styles.textStyle}
      style={styles.tabBar}
    />
  );

  const onTabBarChange = (event) => {
    if (event.i === 0) {
      AnalyticsV2.trackEvent(
        isPrivateKey()
          ? AnalyticsV2.ANALYTICS_EVENTS.REVEAL_PRIVATE_KEY_COMPLETED
          : AnalyticsV2.ANALYTICS_EVENTS.REVEAL_SRP_COMPLETED,
        { action: 'viewed SRP' },
      );
    } else if (event.i === 1) {
      AnalyticsV2.trackEvent(
        isPrivateKey()
          ? AnalyticsV2.ANALYTICS_EVENTS.REVEAL_PRIVATE_KEY_COMPLETED
          : AnalyticsV2.ANALYTICS_EVENTS.REVEAL_SRP_COMPLETED,
        { action: 'viewed QR code' },
      );
    }
  };

  const renderTabView = (privateCredentialName) => {
    Device.isAndroid() &&
      Device.getDeviceAPILevel().then((apiLevel) => {
        if (apiLevel < AppConstants.LEAST_SUPPORTED_ANDROID_API_LEVEL) {
          setIsAndroidSupportedVersion(false);
        }
      });

    return (
      <ScrollableTabView
        renderTabBar={() => renderTabBar()}
        onChangeTab={(event) => onTabBarChange(event)}
      >
        <View
          tabLabel={strings(`reveal_credential.text`)}
          style={styles.tabContent}
        >
          <Text style={styles.boldText}>
            {strings(`reveal_credential.${privateCredentialName}`)}
          </Text>
          <View style={styles.seedPhraseView}>
            <TextInput
              value={clipboardPrivateCredential}
              numberOfLines={3}
              multiline
              selectTextOnFocus
              style={styles.seedPhrase}
              editable={false}
              testID={'private-credential-text'}
              placeholderTextColor={colors.text.muted}
              keyboardAppearance={themeAppearance}
            />
            {isAndroidSupportedVersion && (
              <TouchableOpacity
                style={styles.privateCredentialAction}
                onPress={() =>
                  copyPrivateCredentialToClipboard(privateCredentialName)
                }
                testID={'private-credential-touchable'}
              >
                <Text style={styles.blueText}>
                  {strings('reveal_credential.copy_to_clipboard')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View
          tabLabel={strings(`reveal_credential.qr_code`)}
          style={styles.tabContent}
        >
          <View style={styles.qrCodeWrapper}>
            <View style={styles.qrCode}>
              <QRCode
                value={clipboardPrivateCredential}
                size={Dimensions.get('window').width - 176}
              />
            </View>
          </View>
        </View>
      </ScrollableTabView>
    );
  };

  const renderPasswordEntry = () => (
    <>
      <Text style={styles.enterPassword}>
        {strings('reveal_credential.enter_password')}
      </Text>
      <TextInput
        style={styles.input}
        testID={'private-credential-password-text-input'}
        placeholder={'Password'}
        placeholderTextColor={colors.text.muted}
        onChangeText={onPasswordChange}
        secureTextEntry
        onSubmitEditing={tryUnlock}
        keyboardAppearance={themeAppearance}
      />
      <Text style={styles.warningText} testID={'password-warning'}>
        {warningIncorrectPassword}
      </Text>
    </>
  );

  const closeModal = () => {
    AnalyticsV2.trackEvent(
      isPrivateKey()
        ? AnalyticsV2.ANALYTICS_EVENTS.REVEAL_PRIVATE_KEY_CANCELLED
        : AnalyticsV2.ANALYTICS_EVENTS.REVEAL_SRP_CANCELLED,
      { view: 'Hold to reveal' },
    );

    setIsModalVisible(false);
  };

  const renderModal = (isPrivateKeyReveal, privateCredentialName) => (
    <InfoModal
      isVisible={isModalVisible}
      toggleModal={closeModal}
      title={strings('reveal_credential.keep_credential_safe', {
        credentialName: isPrivateKeyReveal
          ? strings('reveal_credential.private_key_text')
          : strings('reveal_credential.srp_abbreviation_text'),
      })}
      body={
        <>
          <Text style={[styles.normalText, styles.revealModalText]}>
            {
              strings('reveal_credential.reveal_credential_modal', {
                credentialName: isPrivateKeyReveal
                  ? strings('reveal_credential.private_key_text')
                  : strings('reveal_credential.srp_text'),
              })[0]
            }
            <Text style={styles.boldText}>
              {isPrivateKeyReveal
                ? strings('reveal_credential.reveal_credential_modal')[1]
                : strings('reveal_credential.reveal_credential_modal')[2]}
            </Text>
            {strings('reveal_credential.reveal_credential_modal')[3]}
            <TouchableOpacity
              onPress={() => Linking.openURL(KEEP_SRP_SAFE_URL)}
            >
              <Text style={[styles.blueText, styles.link]}>
                {strings('reveal_credential.reveal_credential_modal')[4]}
              </Text>
            </TouchableOpacity>
          </Text>

          <ButtonReveal
            label={strings('reveal_credential.hold_to_reveal_credential', {
              credentialName: isPrivateKeyReveal
                ? strings('reveal_credential.private_key_text')
                : strings('reveal_credential.srp_abbreviation_text'),
            })}
            onLongPress={() => revealCredential(privateCredentialName)}
          />
        </>
      }
    />
  );

  const renderSRPExplanation = () => (
    <Text style={styles.normalText}>
      {strings('reveal_credential.seed_phrase_explanation')[0]}{' '}
      <Text
        style={[styles.blueText, styles.link]}
        onPress={() => Linking.openURL(SRP_GUIDE_URL)}
      >
        {strings('reveal_credential.seed_phrase_explanation')[1]}
      </Text>{' '}
      {strings('reveal_credential.seed_phrase_explanation')[2]}{' '}
      <Text style={styles.boldText}>
        {strings('reveal_credential.seed_phrase_explanation')[3]}
      </Text>
      {strings('reveal_credential.seed_phrase_explanation')[4]}{' '}
      <Text
        style={[styles.blueText, styles.link]}
        onPress={() => Linking.openURL(NON_CUSTODIAL_WALLET_URL)}
      >
        {strings('reveal_credential.seed_phrase_explanation')[5]}{' '}
      </Text>
      {strings('reveal_credential.seed_phrase_explanation')[6]}{' '}
      <Text style={styles.boldText}>
        {strings('reveal_credential.seed_phrase_explanation')[7]}
      </Text>
    </Text>
  );

  const renderWarning = (privateCredentialName) => (
    <View style={styles.warningWrapper}>
      <View style={[styles.rowWrapper, styles.warningRowWrapper]}>
        <Icon style={styles.icon} name="eye-slash" size={20} solid />
        {privateCredentialName === PRIVATE_KEY ? (
          <Text style={styles.warningMessageText}>
            {strings(
              `reveal_credential.${privateCredentialName}_warning_explanation`,
            )}
          </Text>
        ) : (
          <Text style={styles.warningMessageText}>
            {strings('reveal_credential.seed_phrase_warning_explanation')[0]}
            <Text style={styles.boldText}>
              {strings('reveal_credential.seed_phrase_warning_explanation')[1]}
            </Text>
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={styles.wrapper}
      testID={'reveal-private-credential-screen'}
    >
      <ActionView
        cancelText={
          unlocked
            ? strings('reveal_credential.done')
            : strings('reveal_credential.cancel')
        }
        confirmText={strings('reveal_credential.confirm')}
        onCancelPress={unlocked ? navigateBack : cancelReveal}
        testID={`next-button`}
        onConfirmPress={() => tryUnlock()}
        showConfirmButton={!unlocked}
        confirmDisabled={!password.length}
      >
        <>
          <View style={[styles.rowWrapper, styles.normalText]}>
            {isPrivateKey() ? (
              <Text style={styles.normalText}>
                {strings(`reveal_credential.private_key_explanation`)}
              </Text>
            ) : (
              renderSRPExplanation()
            )}
          </View>
          {renderWarning(privateCredentialName)}

          <View style={styles.rowWrapper}>
            {unlocked
              ? renderTabView(privateCredentialName)
              : renderPasswordEntry()}
          </View>
        </>
      </ActionView>
      {renderModal(isPrivateKey(), privateCredentialName)}
    </SafeAreaView>
  );
};

RevealPrivateCredential.propTypes = {
  /**
  /* navigation object required to push new views
  */
  navigation: PropTypes.object,
  /**
   * Action that shows the global alert
   */
  showAlert: PropTypes.func.isRequired,
  /**
   * String that represents the selected address
   */
  selectedAddress: PropTypes.string,
  /**
   * String that determines whether to show the seedphrase or private key export screen
   */
  credentialName: PropTypes.string,
  /**
   * Cancel function to be called when cancel button is clicked. If not provided, we go to previous screen on cancel
   */
  cancel: PropTypes.func,
  /**
   * Object that represents the current route info like params passed to it
   */
  route: PropTypes.object,
  /**
   * Boolean that indicates if navbar should be disabled
   */
  navBarDisabled: PropTypes.bool,
};

const mapStateToProps = (state) => ({
  selectedAddress:
    state.engine.backgroundState.PreferencesController.selectedAddress,
});

const mapDispatchToProps = (dispatch) => ({
  showAlert: (config) => dispatch(showAlert(config)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RevealPrivateCredential);
